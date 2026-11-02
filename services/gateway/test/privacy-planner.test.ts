import { expect, test, vi } from 'vitest';
import type { Keyframe, ServerMessage } from '@fingerpost/protocol';
import { SessionPipeline } from '../src/session/pipeline.ts';
import { MOCK_LAYOUT, mockModels } from '../src/models/mock/mock-models.ts';
import { createRouter } from '../src/models/router.ts';
import { rulesPlanner } from '../src/agent/planner.ts';
import { MemoryService } from '../src/memory/service.ts';
import { InMemoryStore } from '../src/memory/store.ts';

const frame: Keyframe = { type: 'keyframe', id: 'k', ts: 1, kind: 'screen', purpose: 'locate', imageSize: { w: 1000, h: 500 }, ocrTokens: [] };
const jpeg = new Uint8Array([0xff, 0xd8]);
function setup(sensitivity: 'none' | 'financial' | 'identity' = 'none', privateAvailable = true) {
  const base = mockModels({ ...MOCK_LAYOUT, sensitivity });
  const parseMeta = vi.fn(base.parseScreen), parsePrivate = vi.fn(base.parseScreen);
  const boxMeta = vi.fn(base.segmentByBox), boxPrivate = vi.fn(base.segmentByBox);
  const meta = { ...base, parseScreen: parseMeta, segmentByBox: boxMeta }, glimmer = { ...base, parseScreen: parsePrivate, segmentByBox: boxPrivate };
  const next = vi.fn(rulesPlanner().next);
  const sent: ServerMessage[] = [];
  const p = new SessionPipeline({ models: meta, route: createRouter({ meta, ...(privateAvailable ? { glimmer } : {}) }),
    planner: { id: 'synthetic-external', next }, send: m => sent.push(m) });
  p.setMode('task');
  return { p, sent, next, parseMeta, parsePrivate, glimmer, boxMeta, boxPrivate };
}

test('private task remains functional without exposing any agent state to the external planner', async () => {
  const { p, sent, next, parseMeta } = setup();
  p.setPrivacy('private'); p.onGoal('Order a medium cola and pay');
  await p.onKeyframe(frame, jpeg);
  expect(next).not.toHaveBeenCalled(); expect(parseMeta).not.toHaveBeenCalled();
  expect(sent.some(m => m.type === 'ask' || m.type === 'target' || m.type === 'confirm')).toBe(true);
});

test.each(['financial', 'identity'] as const)('%s state and its later history never reach the external planner', async sensitivity => {
  const { p, next, parseMeta, parsePrivate } = setup(sensitivity);
  p.onGoal('Order a medium cola and pay'); await p.onKeyframe(frame, jpeg);
  expect(next).not.toHaveBeenCalled();
  p.onGoal('Order another cola and pay'); await p.onKeyframe({ ...frame, id: 'k2' }, jpeg);
  expect(parseMeta).toHaveBeenCalledTimes(1); expect(parsePrivate).toHaveBeenCalledTimes(1);
  expect(next).not.toHaveBeenCalled();
});

test('a new goal and abort cannot clear sensitivity and send the next frame to Meta', async () => {
  const { p, sent, parseMeta, next } = setup('financial', false);
  p.onGoal('Order a cola and pay'); await p.onKeyframe(frame, jpeg);
  p.abort(); p.onGoal('Order another cola and pay');
  await p.onKeyframe({ ...frame, id: 'k2' }, jpeg);
  expect(parseMeta).toHaveBeenCalledTimes(1); expect(next).not.toHaveBeenCalled();
  expect(sent.at(-1)).toMatchObject({ type: 'error', code: 'model_unavailable', retryable: false });
});

test('ordinary nonsensitive tasks still use the configured planner', async () => {
  const { p, next } = setup(); p.onGoal('Order a cola and pay'); await p.onKeyframe(frame, jpeg);
  expect(next).toHaveBeenCalled();
});

test('the first financial classification also protects target refinement', async () => {
  const { p, boxMeta, boxPrivate } = setup('financial');
  p.setMode('guide'); p.onGoal('start'); await p.onKeyframe(frame, jpeg);
  expect(boxMeta).not.toHaveBeenCalled(); expect(boxPrivate).toHaveBeenCalledTimes(1);
});

test('private planning stays local after a later safe layout so protected history cannot escape', async () => {
  const { p, next, glimmer, parseMeta } = setup('identity');
  p.onGoal('Order a cola and pay'); await p.onKeyframe(frame, jpeg);
  glimmer.parseScreen.mockImplementation(mockModels().parseScreen);
  p.onGoal('Order another cola and pay'); await p.onKeyframe({ ...frame, id: 'k2' }, jpeg);
  await p.onKeyframe({ ...frame, id: 'k3' }, jpeg);
  expect(next).not.toHaveBeenCalled(); expect(parseMeta).toHaveBeenCalledTimes(2);
});

test('private sessions without a router cannot bypass refusal through the default model port', async () => {
  const parse = vi.fn(mockModels().parseScreen);
  const sent: ServerMessage[] = [];
  const p = new SessionPipeline({ models: { ...mockModels(), parseScreen: parse }, send: m => sent.push(m) });
  p.setPrivacy('private'); p.onGoal('start'); await p.onKeyframe(frame, jpeg);
  expect(parse).not.toHaveBeenCalled(); expect(sent.at(-1)).toMatchObject({ type: 'error', code: 'model_unavailable' });
});

test('memory cannot clear sensitive routing before a fresh safe model classification', async () => {
  const meta = mockModels({ ...MOCK_LAYOUT, sensitivity: 'identity' });
  const glimmer = mockModels({ ...MOCK_LAYOUT, sensitivity: 'identity' });
  const parseMeta = vi.spyOn(meta, 'parseScreen'), parsePrivate = vi.spyOn(glimmer, 'parseScreen');
  const memory = new MemoryService(new InMemoryStore(), { salt: 'synthetic-salt' });
  const lookup = vi.spyOn(memory, 'lookup').mockResolvedValue(null);
  const p = new SessionPipeline({ models: meta, route: createRouter({ meta, glimmer }), memory, send: () => {} });
  p.onGoal('start'); await p.onKeyframe(frame, jpeg);
  lookup.mockResolvedValue({ ...MOCK_LAYOUT, id: 'memory', ts: 1, type: 'layout', fingerprint: 'sh64:0123456789abcdef', source: 'memory' });
  lookup.mockClear();
  p.onGoal('start'); await p.onKeyframe({ ...frame, id: 'next', ocrTokens: [{ text: 'Start', box: { u: 0, v: 0, w: 1, h: 1 } }] }, jpeg);
  expect(lookup).not.toHaveBeenCalled(); expect(parsePrivate).toHaveBeenCalledTimes(1);
  p.onGoal('start'); await p.onKeyframe({ ...frame, id: 'third' }, jpeg);
  expect(parseMeta).toHaveBeenCalledTimes(1); expect(parsePrivate).toHaveBeenCalledTimes(2);
});
