import { expect, test, vi } from 'vitest';
import type { Keyframe, ServerMessage } from '@fingerpost/protocol';
import { MOCK_LAYOUT, mockModels } from '../src/models/mock/mock-models.ts';
import type { ModelPort } from '../src/models/port.ts';
import { labelJaccard, layoutFingerprint, MAX_CALLS_PER_TASK, SessionPipeline, simMatches, type PipelineDeps } from '../src/session/pipeline.ts';
import { describePosition, listLabels } from '../src/resolve/describe.ts';

const kf = (purpose: Keyframe['purpose'], id = 'k1'): Keyframe => ({ type: 'keyframe', id, ts: 1, kind: 'screen', imageSize: { w: 1000, h: 500 }, ocrTokens: [], purpose });
const jpeg = new Uint8Array([0xff, 0xd8]);
const run = (models: ModelPort = mockModels(), extra: Partial<PipelineDeps> = {}) => { const sent: ServerMessage[] = []; return { p: new SessionPipeline({ models, send: (m) => sent.push(m), now: () => 42, ...extra }), sent }; };

test('goal → goal.ack with intent guide', () => {
  const { p, sent } = run();
  p.onGoal('press start');
  expect(sent).toEqual([expect.objectContaining({ type: 'goal.ack', goal: 'press start', intent: 'guide', ts: 42 })]);
});

test('locate: layout first, then a SAM-refined target with a spoken position', async () => {
  const { p, sent } = run();
  p.onGoal('press start'); sent.length = 0;
  await p.onKeyframe(kf('locate'), jpeg);
  expect(sent.map((m) => m.type)).toEqual(['say', 'layout', 'target']);
  const t = sent[2] as Extract<ServerMessage, { type: 'target' }>;
  expect(t.elementId).toBe('e5');
  expect(t.say).toBe('Found Start, bottom right.');
  expect(t.polygon[0]!.u).toBeCloseTo(0.6 + 0.3 * 0.02, 6); // mock SAM shrinks the box by 2%
});

test('locate with nothing matching → ask listing what is there', async () => {
  const { p, sent } = run();
  p.onGoal('defrost'); sent.length = 0;
  await p.onKeyframe(kf('locate'), jpeg);
  expect(sent[2]).toMatchObject({ type: 'ask', question: "I can't find that. I see Timer, Power, Stop and Start. What do you want to press?", options: ['Timer', 'Power', 'Stop', 'Start'] });
});

test('ambiguous goal → ask which one', async () => {
  const twoStarts = { ...MOCK_LAYOUT, elements: [...MOCK_LAYOUT.elements, { ...MOCK_LAYOUT.elements[4]!, id: 'e6', label: 'Start', textNorm: 'start' }] };
  const { p, sent } = run(mockModels(twoStarts));
  p.onGoal('start'); sent.length = 0;
  await p.onKeyframe(kf('locate'), jpeg);
  expect(sent[2]).toMatchObject({ type: 'ask', question: 'I see Start and Start. Which one?' });
});

test('verify with an unchanged layout → nochange', async () => {
  const { p, sent } = run();
  p.onGoal('start'); await p.onKeyframe(kf('locate'), jpeg); sent.length = 0;
  await p.onKeyframe(kf('verify', 'k2'), jpeg);
  expect(sent[1]).toMatchObject({ type: 'verify', re: 'k2', result: 'nochange' });
});

test('verify after a matching sim touch → ok; after a different element → wrong with actualElementId', async () => {
  const a = run();
  a.p.onGoal('start'); await a.p.onKeyframe(kf('locate'), jpeg);
  a.p.onSimTouch('start'); a.sent.length = 0;
  await a.p.onKeyframe(kf('verify', 'k2'), jpeg);
  expect(a.sent[1]).toMatchObject({ type: 'verify', result: 'ok', say: 'Done.' });

  const b = run();
  b.p.onGoal('start'); await b.p.onKeyframe(kf('locate'), jpeg);
  b.p.onSimTouch('timer'); b.sent.length = 0;
  await b.p.onKeyframe(kf('verify', 'k3'), jpeg);
  expect(b.sent[1]).toMatchObject({ type: 'verify', result: 'wrong', actualElementId: 'timer' });
});

test('verify when the screen changed → ok', async () => {
  let call = 0;
  const base = mockModels();
  const changing: ModelPort = { ...base, parseScreen: async (i, o) => (call++ === 0 ? base.parseScreen(i, o) : { ...(await base.parseScreen(i, o)), layout: { ...MOCK_LAYOUT, elements: MOCK_LAYOUT.elements.slice(0, 1) } }) };
  const { p, sent } = run(changing);
  p.onGoal('start'); await p.onKeyframe(kf('locate'), jpeg); sent.length = 0;
  await p.onKeyframe(kf('verify', 'k2'), jpeg);
  expect(sent[1]).toMatchObject({ result: 'ok' });
});

test('model failure propagates so the hub can turn it into model_unavailable', async () => {
  const broken: ModelPort = { ...mockModels(), parseScreen: async () => { throw new Error('503'); } };
  const { p } = run(broken);
  p.onGoal('start');
  await expect(p.onKeyframe(kf('locate'), jpeg)).rejects.toThrow('503');
});

test('no billed call without a goal, without a charged task, past the per-task cap, or with the cloud paused', async () => {
  const parse = vi.fn(mockModels().parseScreen);
  let enabled = true;
  const { p, sent } = run({ ...mockModels(), parseScreen: parse }, { cloudEnabled: async () => enabled });
  await p.onKeyframe(kf('locate'), jpeg);
  await p.onKeyframe(kf('verify', 'k0'), jpeg);
  expect(parse).not.toHaveBeenCalled();
  p.onGoal('start');
  for (let i = 0; i < MAX_CALLS_PER_TASK + 1; i++) await p.onKeyframe(kf('verify', `v${i}`), jpeg);
  expect(parse).not.toHaveBeenCalled();
  await p.onKeyframe(kf('locate'), jpeg);
  for (let i = 1; i < MAX_CALLS_PER_TASK; i++) await p.onKeyframe(kf('verify', `w${i}`), jpeg);
  expect(parse).toHaveBeenCalledTimes(MAX_CALLS_PER_TASK);
  await p.onKeyframe(kf('verify', 'over'), jpeg);
  expect(sent.at(-1)).toMatchObject({ type: 'error', code: 'rate_limited' });
  p.onGoal('timer'); enabled = false;
  await p.onKeyframe(kf('locate'), jpeg);
  expect(sent.at(-1)).toMatchObject({ type: 'error', code: 'cloud_paused' });
  expect(parse).toHaveBeenCalledTimes(MAX_CALLS_PER_TASK);
});

test('helpers: fingerprint is order-independent; jaccard; position words; label lists; sim id matching', () => {
  const els = MOCK_LAYOUT.elements;
  expect(layoutFingerprint(els)).toBe(layoutFingerprint([...els].reverse()));
  expect(layoutFingerprint(els)).toMatch(/^sh64:[0-9a-f]{16}$/);
  expect(labelJaccard(els, els)).toBe(1);
  expect(labelJaccard(els, els.slice(0, 1))).toBeCloseTo(0.2);
  expect(describePosition([{ u: 0.1, v: 0.1 }, { u: 0.2, v: 0.2 }])).toBe('top left');
  expect(describePosition([{ u: 0.5, v: 0.5 }])).toBe('middle');
  expect(describePosition([{ u: 0.5, v: 0.9 }])).toBe('bottom');
  expect(listLabels(els)).toBe('Timer, Power, Stop and Start');
  expect(simMatches('pay-card', { ...els[0]!, label: 'Pay by card' })).toBe(true);
  expect(simMatches('cancel', { ...els[0]!, label: 'Pay by card' })).toBe(false);
});

test('says looking once per goal on locate', async () => {
  const { p, sent } = run();
  p.onGoal('press start');
  sent.length = 0;
  await p.onKeyframe(kf('locate'), jpeg);
  const lookings = sent.filter((m) => m.type === 'say' && m.text === 'Looking at the screen.');
  expect(lookings).toHaveLength(1);
  expect(lookings[0]).toMatchObject({ type: 'say', priority: 'state', text: 'Looking at the screen.' });

  // A second locate keyframe for the same goal should not say it again
  await p.onKeyframe(kf('locate', 'k2'), jpeg);
  expect(sent.filter((m) => m.type === 'say' && m.text === 'Looking at the screen.')).toHaveLength(1);

  // A new goal resets the flag, so the next locate keyframe says it again
  p.onGoal('timer');
  sent.length = 0;
  await p.onKeyframe(kf('locate', 'k3'), jpeg);
  expect(sent.filter((m) => m.type === 'say' && m.text === 'Looking at the screen.')).toHaveLength(1);

  // Abort also resets the flag
  p.abort();
  p.onGoal('stop');
  sent.length = 0;
  await p.onKeyframe(kf('locate', 'k4'), jpeg);
  expect(sent.filter((m) => m.type === 'say' && m.text === 'Looking at the screen.')).toHaveLength(1);
});

test('no looking message on verify', async () => {
  const { p, sent } = run();
  p.onGoal('press start');
  await p.onKeyframe(kf('locate'), jpeg);
  sent.length = 0;
  await p.onKeyframe(kf('verify', 'k2'), jpeg);
  expect(sent.some((m) => m.type === 'say' && m.text === 'Looking at the screen.')).toBe(false);
});


// ── B4-4: Hindi and Spanish server speech ──────────────────────────────────────────────────────────────
test('hindi session gets hindi target say', async () => {
  const { p, sent } = run();
  p.setLocale('hi');
  p.onGoal('press start'); sent.length = 0;
  await p.onKeyframe(kf('locate'), jpeg);
  expect(sent.map((m) => m.type)).toEqual(['say', 'layout', 'target']);
  expect(sent[0]).toMatchObject({ type: 'say', text: 'स्क्रीन देख रहा हूँ।' });
  expect((sent[2] as Extract<ServerMessage, { type: 'target' }>).say).toBe('Start मिला, नीचे दाईं ओर।');
});

test('spanish session gets spanish asks and verify speech', async () => {
  const { p, sent } = run();
  p.setLocale('es');
  p.onGoal('defrost'); sent.length = 0;
  await p.onKeyframe(kf('locate'), jpeg);
  expect(sent[2]).toMatchObject({ type: 'ask', question: 'No lo encuentro. Veo Timer, Power, Stop y Start. ¿Qué quieres pulsar?' });
  p.onGoal('start'); sent.length = 0;
  await p.onKeyframe(kf('locate'), jpeg);
  await p.onKeyframe(kf('verify', 'k2'), jpeg);
  expect(sent.find((m) => m.type === 'verify')).toMatchObject({ say: 'La pantalla no cambió. Pulsa un poco más firme.' });
});
