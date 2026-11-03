import { expect, test, vi } from 'vitest';
import type { Keyframe, LayoutElement, ServerMessage } from '@fingerpost/protocol';
import { SessionPipeline } from '../src/session/pipeline.ts';
import { MOCK_LAYOUT, mockModels } from '../src/models/mock/mock-models.ts';
import { MemoryService } from '../src/memory/service.ts';
import { InMemoryStore } from '../src/memory/store.ts';

const frame: Keyframe = { type: 'keyframe', id: 'k', ts: 1, kind: 'screen', purpose: 'locate',
  imageSize: { w: 1000, h: 500 }, ocrTokens: [] };
const jpeg = new Uint8Array([0xff, 0xd8]);

test.each(['pay', 'confirm', 'submit'] as const)('guide intent cannot bypass the server confirm gate for %s', async role => {
  const element: LayoutElement = { ...MOCK_LAYOUT.elements[4]!, role };
  const models = mockModels({ ...MOCK_LAYOUT, elements: [element] });
  const box = vi.spyOn(models, 'segmentByBox');
  const sent: ServerMessage[] = [];
  const p = new SessionPipeline({ models, send: m => sent.push(m) });
  p.setMode('guide'); p.onGoal('start'); await p.onKeyframe(frame, jpeg);
  expect(sent.some(m => m.type === 'target')).toBe(false); expect(box).not.toHaveBeenCalled();
  expect(sent.at(-1)).toMatchObject({ type: 'say', priority: 'safety', text: 'I need you to confirm the amount first.' });
});

test('a stale or poisoned memory entry cannot bypass the same confirm gate', async () => {
  const memory = new MemoryService(new InMemoryStore(), { salt: 'synthetic' });
  vi.spyOn(memory, 'lookup').mockResolvedValue({ ...MOCK_LAYOUT, id: 'l', ts: 1, type: 'layout',
    fingerprint: 'sh64:0123456789abcdef', source: 'memory', elements: [{ ...MOCK_LAYOUT.elements[4]!, role: 'pay' }] });
  const sent: ServerMessage[] = [];
  const p = new SessionPipeline({ models: mockModels(), memory, send: m => sent.push(m) });
  p.setMode('guide'); p.onGoal('start');
  await p.onKeyframe({ ...frame, ocrTokens: [{ text: 'Start', box: { u: 0, v: 0, w: 1, h: 1 } }] }, jpeg);
  expect(sent.some(m => m.type === 'target')).toBe(false);
  expect(sent.at(-1)).toMatchObject({ type: 'say', priority: 'safety' });
});
