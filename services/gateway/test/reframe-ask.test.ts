import { expect, test, vi } from 'vitest';
import { ServerMessage, type Keyframe } from '@fingerpost/protocol';
import { SessionPipeline } from '../src/session/pipeline.ts';
import { MOCK_LAYOUT, mockModels } from '../src/models/mock/mock-models.ts';

const full: Keyframe = { type: 'keyframe', id: 'k', ts: 1, kind: 'full', purpose: 'locate', imageSize: { w: 1000, h: 500 }, ocrTokens: [] };
const jpeg = new Uint8Array([0xff, 0xd8]);

function run(goal: string, models = mockModels()) {
  const sent: ServerMessage[] = [];
  const p = new SessionPipeline({ models, send: (m) => { ServerMessage.parse(m); sent.push(m); } });
  p.onGoal(goal);
  return { p, sent };
}

test('a full frame without a usable screen plane asks the client to re-frame', async () => {
  const models = mockModels();
  models.segmentByText = vi.fn(async () => ({ polygon: null, confidence: null, latencyMs: 0 }));
  const { p, sent } = run('start', models);
  await p.onKeyframe(full, jpeg);
  expect(sent.at(-1)).toMatchObject({ type: 'ask', reason: 'reframe', question: "I can't find the screen. Hold the phone steady and try again." });
});

test('a missing button is a question for the user, not a re-frame', async () => {
  const models = mockModels({ ...MOCK_LAYOUT });
  const { p, sent } = run('eject the disc', models);
  await p.onKeyframe({ ...full, kind: 'screen' }, jpeg);
  const ask = sent.at(-1)!;
  expect(ask.type).toBe('ask');
  expect('reason' in ask).toBe(false);
});

test.each([['not_found', true], ['turn', false]] as const)('focused grounding %s → reframe=%s', async (actuation, reframe) => {
  const models = { ...mockModels(), groundControl: vi.fn(async () => ({ actuation, polygon: null, confidence: 0.9,
    usage: { inputTokens: 1, outputTokens: 1 }, latencyMs: 0, promptId: 'synthetic' })) };
  const { p, sent } = run('start', models);
  await p.onKeyframe({ ...full, kind: 'screen' }, jpeg);
  const ask = sent.at(-1)!;
  expect(ask.type).toBe('ask');
  expect((ask as { reason?: string }).reason === 'reframe').toBe(reframe);
});
