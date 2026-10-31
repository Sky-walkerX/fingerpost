import { expect, test, vi } from 'vitest';
import { ServerMessage, type Keyframe, type LayoutElement } from '@fingerpost/protocol';
import { MOCK_LAYOUT, mockModels } from '../src/models/mock/mock-models.ts';
import type { ModelPort } from '../src/models/port.ts';
import type { Usage } from '../src/quota/cost.ts';
import { SessionPipeline, labelJaccard, layoutFingerprint, type PipelineDeps } from '../src/session/pipeline.ts';

const jpeg = new Uint8Array([0xff, 0xd8]);
const kf = (purpose: Keyframe['purpose'], id = 'k1'): Keyframe => ({ type: 'keyframe', id, ts: 1, kind: 'screen', imageSize: { w: 1000, h: 500 }, ocrTokens: [], purpose });
function run(extra: Partial<PipelineDeps> = {}) {
  const sent: ServerMessage[] = [];
  const p = new SessionPipeline({ models: mockModels(), now: () => 42, ...extra, send: (m) => { ServerMessage.parse(m); sent.push(m); } });
  return { p, sent };
}

test('a denied task gate sends its spoken error before any model call or usage', async () => {
  const models = mockModels(), parse = vi.spyOn(models, 'parseScreen'), usage = vi.fn();
  const gate = vi.fn(async () => ({ ok: false, code: 'quota_exhausted' }) as const);
  const { p, sent } = run({ models, beforeTask: gate, onUsage: usage });
  p.onGoal('start'); sent.length = 0;
  await p.onKeyframe(kf('locate'), jpeg);
  expect(sent).toMatchObject([{ type: 'error', code: 'quota_exhausted', retryable: false }]);
  expect(parse).not.toHaveBeenCalled(); expect(usage).not.toHaveBeenCalled();
});

test('charge once across retries and verification, then again for a new goal', async () => {
  const gate = vi.fn(async () => ({ ok: true, tasksLeft: 2 }) as const);
  const { p } = run({ beforeTask: gate });
  p.onGoal('start');
  await p.onKeyframe(kf('locate'), jpeg); await p.onKeyframe(kf('locate', 'k2'), jpeg);
  await p.onKeyframe(kf('verify', 'k3'), jpeg);
  expect(gate).toHaveBeenCalledTimes(1);
  p.onGoal('timer'); await p.onKeyframe(kf('locate', 'k4'), jpeg);
  expect(gate).toHaveBeenCalledTimes(2);
});

test('a denied task may retry after the gate opens', async () => {
  const gate = vi.fn<NonNullable<PipelineDeps['beforeTask']>>()
    .mockResolvedValueOnce({ ok: false, code: 'cloud_paused' }).mockResolvedValue({ ok: true, tasksLeft: 1 });
  const { p, sent } = run({ beforeTask: gate });
  p.onGoal('start'); await p.onKeyframe(kf('locate'), jpeg); await p.onKeyframe(kf('locate', 'k2'), jpeg);
  expect(gate).toHaveBeenCalledTimes(2); expect(sent.at(-1)?.type).toBe('target');
});

test('locale, image, pixel box, usage and conservative confidence reach the model/result', async () => {
  const models = mockModels(), parse = vi.spyOn(models, 'parseScreen'), segment = vi.spyOn(models, 'segmentByBox');
  const usage: Usage[] = [];
  const { p, sent } = run({ models, onUsage: (u) => { usage.push(u); } });
  p.setLocale('hi'); p.onGoal('start'); await p.onKeyframe(kf('locate'), jpeg);
  expect(parse).toHaveBeenCalledWith({ bytes: jpeg, mime: 'image/jpeg' }, { locale: 'hi', goal: 'start' });
  expect(segment).toHaveBeenCalledWith({ bytes: jpeg, mime: 'image/jpeg', width: 1000, height: 500 },
    { left: 600, top: 350, right: 900, bottom: 440 });
  expect(usage).toEqual([{ kind: 'spark', inputTokens: 0, outputTokens: 0 }, { kind: 'sam_image', images: 1 }]);
  expect(sent.at(-1)).toMatchObject({ type: 'target', confidence: 0.9 });
});

test('missing SAM mask falls back to the element polygon and confidence', async () => {
  const models: ModelPort = { ...mockModels(), segmentByBox: async () => ({ polygon: null, confidence: 0, latencyMs: 0 }) };
  const { p, sent } = run({ models }); p.onGoal('start'); await p.onKeyframe(kf('locate'), jpeg);
  expect(sent.at(-1)).toMatchObject({ type: 'target', polygon: MOCK_LAYOUT.elements[4]!.polygon, confidence: 0.95 });
});

test('a SAM polygon without a confidence preserves the element confidence', async () => {
  const models: ModelPort = { ...mockModels(), segmentByBox: async () => ({ polygon: MOCK_LAYOUT.elements[4]!.polygon, confidence: null, latencyMs: 0 }) };
  const { p, sent } = run({ models }); p.onGoal('start'); await p.onKeyframe(kf('locate'), jpeg);
  expect(sent.at(-1)).toMatchObject({ type: 'target', confidence: 0.95 });
});

test('sim press evidence is consumed once and new goals discard stale target/touch state', async () => {
  const { p, sent } = run(); p.onGoal('start'); await p.onKeyframe(kf('locate'), jpeg);
  p.onSimTouch('start'); await p.onKeyframe(kf('verify', 'k2'), jpeg);
  expect(sent.at(-1)).toMatchObject({ type: 'verify', result: 'ok' });
  await p.onKeyframe(kf('verify', 'k3'), jpeg);
  expect(sent.at(-1)).toMatchObject({ type: 'verify', result: 'nochange' });
  p.onSimTouch('timer'); p.onGoal('start'); await p.onKeyframe(kf('verify', 'k4'), jpeg);
  expect(sent.at(-1)).toMatchObject({ type: 'verify', result: 'nochange' });
});

test('empty/read-only layouts ask without calling SAM', async () => {
  const models = mockModels({ ...MOCK_LAYOUT, elements: MOCK_LAYOUT.elements.slice(0, 1) });
  const segment = vi.spyOn(models, 'segmentByBox'); const { p, sent } = run({ models });
  p.onGoal('start'); await p.onKeyframe(kf('locate'), jpeg);
  expect(sent.at(-1)).toMatchObject({ type: 'ask', question: "I can't find that. I see nothing I can read. What do you want to press?", options: [] });
  expect(segment).not.toHaveBeenCalled();
});

test('ask questions and options stay within protocol bounds with long model labels', async () => {
  const elements = Array.from({ length: 12 }, (_, i) => ({ ...MOCK_LAYOUT.elements[1]!, id: `e${i}`, label: `Synthetic ${i} ${'x'.repeat(180)}`, textNorm: `synthetic ${i}` }));
  const { p, sent } = run({ models: mockModels({ ...MOCK_LAYOUT, elements }) });
  p.onGoal('missing'); await p.onKeyframe(kf('locate'), jpeg);
  const ask = sent.at(-1);
  expect(ask?.type).toBe('ask');
  if (ask?.type === 'ask') { expect(ask.question.length).toBeLessThanOrEqual(300); expect(ask.options).toHaveLength(8); expect(ask.options.every((s) => s.length <= 100)).toBe(true); }
});

test('fingerprints use sorted label keys and Jaccard treats duplicate labels as a set', () => {
  const a: LayoutElement = { ...MOCK_LAYOUT.elements[1]!, label: 'TIMER', textNorm: undefined };
  expect(layoutFingerprint([a])).toBe(layoutFingerprint([{ ...a, textNorm: 'timer' }]));
  expect(labelJaccard([], [])).toBe(1); expect(labelJaccard([a], [])).toBe(0);
  expect(labelJaccard([a, a], [a])).toBe(1);
});

test('the 0.7 screen-change threshold is strict', async () => {
  const elements = Array.from({ length: 10 }, (_, i) => ({ ...MOCK_LAYOUT.elements[1]!, id: `e${i}`, label: `Control ${i}`, textNorm: `control ${i}` }));
  for (const [remaining, result] of [[7, 'nochange'], [6, 'ok']] as const) {
    let calls = 0;
    const models = mockModels({ ...MOCK_LAYOUT, elements });
    const parse = models.parseScreen;
    models.parseScreen = async (image, opts) => ({ ...(await parse(image, opts)), layout: { ...MOCK_LAYOUT, elements: calls++ ? elements.slice(0, remaining) : elements } });
    const { p, sent } = run({ models }); p.onGoal('Control 0'); await p.onKeyframe(kf('locate'), jpeg);
    await p.onKeyframe(kf('verify', 'k2'), jpeg); expect(sent.at(-1)).toMatchObject({ type: 'verify', result });
  }
});
