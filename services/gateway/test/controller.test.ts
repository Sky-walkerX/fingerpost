import { expect, test, vi } from 'vitest';
import { encodeFrame, ServerMessage } from '@fingerpost/protocol';
import type { AsrSink } from '../src/asr/relay.ts';
import { mockModels } from '../src/models/mock/mock-models.ts';
import { createSessionController, type AsrFactory } from '../src/session/controller.ts';
import type { QuotaPort } from '../src/session/types.ts';
import { SimRegistry } from '../src/sim/registry.ts';

const hello = (run = 'run-1') => ({ type: 'hello', id: 'h1', ts: 1, appVersion: '0.1.0', protocol: 'fp.v1', locale: 'hi', mode: 'guide', privacy: 'normal', caps: { simRunId: run } });
const audio = encodeFrame({ type: 'audio', id: 'a1', ts: 2, seq: 0, sampleRate: 16000 }, new Uint8Array(640));
const keyframe = encodeFrame({ type: 'keyframe', id: 'k1', ts: 3, kind: 'screen', purpose: 'locate', imageSize: { w: 1000, h: 500 }, ocrTokens: [] }, new Uint8Array([0xff, 0xd8]));
const touch = { runId: 'run-1', screenId: 'home', x: 1, y: 1, u: 0.1, v: 0.1, elementId: 'start', ts: 4 };

function setup(quota?: QuotaPort) {
  const sinks: AsrSink[] = [], relays: Array<{ push: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }> = [];
  const asr = vi.fn<AsrFactory>((_options, sink) => {
    sinks.push(sink); const relay = { push: vi.fn(), end: vi.fn(), close: vi.fn() }; relays.push(relay); return relay;
  });
  const sent: ServerMessage[] = [], sims = new SimRegistry();
  const controller = createSessionController({ models: mockModels(), asr, sims, now: () => 42,
    send: (message) => { ServerMessage.parse(message); sent.push(message); },
    ...(quota ? { quota, claims: { uid: 'synthetic-user', keyId: 'synthetic-key', tier: 'hardware' as const } } : {}) });
  const text = (message: object) => controller.hub.onText(JSON.stringify(message));
  return { ...controller, text, sent, sims, asr, sinks, relays };
}

test('typed goals and answers reach the pipeline and provide labels/locale to ASR', async () => {
  const c = setup(); await c.text(hello());
  await c.text({ type: 'goal', id: 'g1', ts: 2, text: 'start', source: 'typed' }); await c.hub.onBinary(keyframe);
  await c.hub.onBinary(audio);
  expect(c.asr).toHaveBeenCalledWith({ locales: ['hi'], keywords: ['Timer', 'Power', 'Stop', 'Start'] }, expect.anything());
  c.sinks[0]!.partial('start'); c.sinks[0]!.final('start');
  expect(c.sent.slice(-3)).toMatchObject([{ type: 'transcript', final: false }, { type: 'transcript', final: true }, { type: 'goal.ack', goal: 'start' }]);
  await c.text({ type: 'answer', id: 'ans', re: 'ask1', ts: 4, text: 'timer' });
  expect(c.sent.at(-1)).toMatchObject({ type: 'goal.ack', goal: 'timer' }); c.dispose();
});

test('ASR failure gives one generic retry and late callbacks cannot affect a new utterance', async () => {
  const c = setup(); await c.text(hello()); await c.hub.onBinary(audio);
  c.sinks[0]!.error('synthetic provider detail'); c.sinks[0]!.error('again'); c.sinks[0]!.final('stale');
  expect(c.sent.filter((m) => m.type === 'error')).toMatchObject([{ code: 'model_unavailable', retryable: true, say: "I didn't catch that. Please say it again." }]);
  await c.hub.onBinary(audio); expect(c.asr).toHaveBeenCalledTimes(1);
  await c.text({ type: 'audio.end', id: 'end1', ts: 3 });
  await c.hub.onBinary(audio); c.sinks[0]!.partial('stale'); c.sinks[1]!.final('start');
  expect(c.sent.filter((m) => m.type === 'goal.ack')).toMatchObject([{ goal: 'start' }]);
  expect(JSON.stringify(c.sent)).not.toContain('provider detail'); c.dispose();
});

test('endpointing final ignores trailing audio until the microphone end boundary', async () => {
  const c = setup(); await c.text(hello()); await c.hub.onBinary(audio); c.sinks[0]!.final('start');
  await c.hub.onBinary(audio); await c.hub.onBinary(audio);
  expect(c.asr).toHaveBeenCalledTimes(1);
  await c.text({ type: 'audio.end', id: 'end1', ts: 3 }); await c.hub.onBinary(audio);
  expect(c.asr).toHaveBeenCalledTimes(2); c.dispose();
});

test('audio end closes input once and ASR usage counts only accepted audio', async () => {
  const quota: QuotaPort = { cloudEnabled: vi.fn(async () => true), startTask: vi.fn(async () => ({ ok: true, tasksLeft: 1 }) as const), recordUsage: vi.fn(async () => 0) };
  const c = setup(quota); await c.text(hello()); await c.hub.onBinary(audio);
  await c.text({ type: 'audio.end', id: 'end1', ts: 3 }); await c.text({ type: 'audio.end', id: 'end2', ts: 4 });
  await c.hub.onBinary(audio); c.sinks[0]!.final('start'); c.sinks[0]!.final('again');
  expect(c.relays[0]!.push).toHaveBeenCalledTimes(1); expect(c.relays[0]!.end).toHaveBeenCalledTimes(1);
  expect(quota.recordUsage).toHaveBeenCalledWith({ kind: 'asr', seconds: 0.02 });
  await c.hub.onBinary(keyframe);
  expect(quota.startTask).toHaveBeenCalledWith('synthetic-user', 'hardware');
  expect(quota.recordUsage).toHaveBeenCalledTimes(3); c.dispose();
});

test('abort and dispose close relays, suppress callbacks and unsubscribe exactly once', async () => {
  const c = setup(); await c.text(hello()); await c.hub.onBinary(audio);
  await c.text({ type: 'abort', id: 'abort1', ts: 3 });
  expect(c.sent.at(-1)).toMatchObject({ type: 'finish', result: 'aborted' });
  const afterAbort = c.sent.length; c.sinks[0]!.final('stale'); expect(c.sent).toHaveLength(afterAbort);
  expect(c.relays[0]!.close).toHaveBeenCalledTimes(1);
  await c.hub.onBinary(audio); c.dispose(); c.dispose();
  c.sinks[1]!.error('late'); c.sinks[1]!.final('late');
  expect(c.relays[1]!.close).toHaveBeenCalledTimes(1); expect(c.sims.publish(touch)).toBe(0);
});

test('a repeated hello replaces its run subscription and dispose removes it', async () => {
  const c = setup(); await c.text(hello()); expect(c.sims.publish(touch)).toBe(1);
  await c.text(hello('run-2')); expect(c.sims.publish(touch)).toBe(0);
  expect(c.sims.publish({ ...touch, runId: 'run-2' })).toBe(1);
  c.dispose(); expect(c.sims.publish({ ...touch, runId: 'run-2' })).toBe(0);
});

test('a synchronous ASR factory failure produces the same spoken retry', async () => {
  const sent: ServerMessage[] = [];
  const c = createSessionController({ models: mockModels(), sims: new SimRegistry(), send: (m) => sent.push(m), asr: () => { throw new Error('synthetic private detail'); } });
  await c.hub.onText(JSON.stringify(hello())); await c.hub.onBinary(audio);
  expect(sent.at(-1)).toMatchObject({ type: 'error', say: "I didn't catch that. Please say it again." }); c.dispose();
});

test('quota ledger rejection does not fail an otherwise valid session', async () => {
  const c = setup({ cloudEnabled: async () => true, startTask: async () => ({ ok: true, tasksLeft: 1 }), recordUsage: async () => { throw new Error('synthetic ledger failure'); } });
  await c.text(hello()); await c.text({ type: 'goal', id: 'g1', ts: 2, text: 'start', source: 'typed' });
  await c.hub.onBinary(keyframe); expect(c.sent.at(-1)?.type).toBe('target'); c.dispose();
});

test('registry unsubscribe is idempotent after a new subscription for the same run', () => {
  const sims = new SimRegistry(), listener = vi.fn(); const old = sims.subscribe('run-1', () => {});
  old(); sims.subscribe('run-1', listener); old();
  expect(sims.publish(touch)).toBe(1); expect(listener).toHaveBeenCalledWith(touch);
});
