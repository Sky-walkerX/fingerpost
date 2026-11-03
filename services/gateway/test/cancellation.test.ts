import { afterEach, expect, test, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { encodeFrame, ServerMessage, type Keyframe } from '@fingerpost/protocol';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { mockModels } from '../src/models/mock/mock-models.ts';
import { SessionPipeline } from '../src/session/pipeline.ts';
import { createSessionController } from '../src/session/controller.ts';
import { SimRegistry } from '../src/sim/registry.ts';
import type { ModelPort } from '../src/models/port.ts';
import type { Usage } from '../src/quota/cost.ts';

const hello = { type: 'hello', id: 'hello', ts: 0, appVersion: '0.1.0', protocol: 'fp.v1', locale: 'en', mode: 'guide', privacy: 'normal', caps: {} };
const frame = (purpose: Keyframe['purpose'] = 'locate', id = 'frame'): Keyframe => ({ type: 'keyframe', id, ts: 0, kind: 'screen', purpose, imageSize: { w: 1000, h: 500 }, ocrTokens: [] });
const jpeg = new Uint8Array([0xff, 0xd8]);
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const within50ms = <T>(promise: Promise<T>) => new Promise<T>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('abort did not complete within 50 ms')), 50);
  promise.then((result) => { clearTimeout(timer); resolve(result); }, (error: unknown) => { clearTimeout(timer); reject(error); });
});
function pipeline(models = mockModels()) {
  const sent: ServerMessage[] = [], usage: Usage[] = [];
  const p = new SessionPipeline({ models, send: (m) => { ServerMessage.parse(m); sent.push(m); }, onUsage: (value) => { usage.push(value); } });
  return { p, sent, usage };
}

test('locate before any goal sends nothing billable, including no task gate', async () => {
  const models = mockModels(), parse = vi.spyOn(models, 'parseScreen'), gate = vi.fn();
  const p = new SessionPipeline({ models, send: vi.fn(), beforeTask: gate });
  await p.onKeyframe(frame(), jpeg);
  expect(parse).not.toHaveBeenCalled(); expect(gate).not.toHaveBeenCalled();
});

test('abort releases a pending parse and drops its late result while retaining completed-call accounting', async () => {
  const models = mockModels(), parse = models.parseScreen, pending = deferred<void>();
  models.parseScreen = vi.fn(async (image, options) => { await pending.promise; return parse(image, options); });
  const segment = vi.spyOn(models, 'segmentByBox');
  const { p, sent, usage } = pipeline(models); p.onGoal('start');
  const work = p.onKeyframe(frame(), jpeg);
  await vi.waitFor(() => expect(models.parseScreen).toHaveBeenCalledTimes(1));
  p.abort(); await within50ms(work);
  pending.resolve(); await new Promise(setImmediate);
  expect(segment).not.toHaveBeenCalled();
  expect(sent.map((m) => m.type)).toEqual(['goal.ack', 'say']);
  expect(usage).toEqual([{ kind: 'spark', inputTokens: 0, outputTokens: 0 }]);
  await p.onKeyframe(frame('verify'), jpeg);
  expect(models.parseScreen).toHaveBeenCalledTimes(1);
});

test('abort drops a pending SAM target and preserves usage once that call finishes', async () => {
  const models = mockModels(), segment = models.segmentByBox, pending = deferred<void>();
  models.segmentByBox = vi.fn(async (image, box) => { await pending.promise; return segment(image, box); });
  const { p, sent, usage } = pipeline(models); p.onGoal('start');
  const work = p.onKeyframe(frame(), jpeg);
  await vi.waitFor(() => expect(models.segmentByBox).toHaveBeenCalledTimes(1));
  p.abort(); await within50ms(work); pending.resolve(); await new Promise(setImmediate);
  expect(sent.map((m) => m.type)).toEqual(['goal.ack', 'say', 'layout']);
  expect(usage).toEqual([{ kind: 'spark', inputTokens: 0, outputTokens: 0 }, { kind: 'sam_image', images: 1 }]);
});

test('a new goal invalidates an old pending parse without publishing the old target', async () => {
  const models = mockModels(), parse = models.parseScreen, pending = deferred<void>();
  let calls = 0;
  models.parseScreen = async (image, options) => { if (++calls === 1) await pending.promise; return parse(image, options); };
  const { p, sent } = pipeline(models); p.onGoal('start'); const old = p.onKeyframe(frame(), jpeg);
  await vi.waitFor(() => expect(calls).toBe(1));
  p.onGoal('timer'); await within50ms(old); await p.onKeyframe(frame('locate', 'new'), jpeg);
  pending.resolve(); await new Promise(setImmediate);
  expect(sent.filter((m) => m.type === 'target')).toMatchObject([{ elementId: 'e2' }]);
});

test('abort during a pending task gate makes no model request and suppresses its late refusal', async () => {
  const allowed = deferred<{ ok: false; code: 'cloud_paused' }>();
  const models = mockModels(), parse = vi.spyOn(models, 'parseScreen'), sent: ServerMessage[] = [];
  const p = new SessionPipeline({ models, send: (m) => sent.push(m), beforeTask: () => allowed.promise });
  p.onGoal('start'); const work = p.onKeyframe(frame(), jpeg);
  p.abort(); await within50ms(work);
  allowed.resolve({ ok: false, code: 'cloud_paused' }); await new Promise(setImmediate);
  expect(parse).not.toHaveBeenCalled(); expect(sent.map((m) => m.type)).toEqual(['goal.ack']);
});

test.each([true, false])('abort during the ASR quota check cannot reopen the microphone relay (enabled=%s)', async (enabled) => {
  const pending = deferred<boolean>(), asr = vi.fn(), sent: ServerMessage[] = [];
  const controller = createSessionController({ models: mockModels(), sims: new SimRegistry(), asr, send: (m) => sent.push(m),
    quota: { cloudEnabled: () => pending.promise, startTask: async () => ({ ok: true, tasksLeft: 1 }), recordUsage: async () => 0 } });
  await controller.hub.onText(JSON.stringify(hello));
  const audio = controller.hub.onBinary(encodeFrame({ type: 'audio', id: 'a', ts: 0, seq: 0, sampleRate: 16000 }, new Uint8Array(640)));
  await controller.hub.onText(JSON.stringify({ type: 'abort', id: 'stop', ts: 0 }));
  pending.resolve(enabled); await audio;
  expect(asr).not.toHaveBeenCalled(); expect(sent.map((m) => m.type)).toEqual(['ready', 'finish']); controller.dispose();
});

test('a failed ASR quota check after abort cannot publish an error into the next turn', async () => {
  const pending = deferred<boolean>(), sent: ServerMessage[] = [];
  const controller = createSessionController({ models: mockModels(), sims: new SimRegistry(), asr: vi.fn(), send: (m) => sent.push(m),
    quota: { cloudEnabled: () => pending.promise, startTask: async () => ({ ok: true, tasksLeft: 1 }), recordUsage: async () => 0 } });
  await controller.hub.onText(JSON.stringify(hello));
  const audio = controller.hub.onBinary(encodeFrame({ type: 'audio', id: 'a', ts: 0, seq: 0, sampleRate: 16000 }, new Uint8Array(640)));
  await controller.hub.onText(JSON.stringify({ type: 'abort', id: 'stop', ts: 0 }));
  pending.reject(new Error('synthetic quota failure')); await audio;
  expect(sent.map((m) => m.type)).toEqual(['ready', 'finish']); controller.dispose();
});

let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });
async function socket(models: ModelPort, options: { flagStore?: { getCloudEnabled(): Promise<boolean>; setCloudEnabled(value: boolean): Promise<void> }; sendHello?: boolean } = {}) {
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }), { models, ...(options.flagStore ? { flagStore: options.flagStore } : {}) }); await app.ready();
  const ws = await app.injectWS('/v1/session'), sent: ServerMessage[] = [];
  const waits: Array<{ type: ServerMessage['type']; resolve: (message: ServerMessage) => void }> = [];
  ws.on('message', (data: Buffer) => {
    const message = ServerMessage.parse(JSON.parse(data.toString())); sent.push(message);
    for (const waiter of waits.filter((waiter) => waiter.type === message.type)) {
      waits.splice(waits.indexOf(waiter), 1); waiter.resolve(message);
    }
  });
  const next = (type: ServerMessage['type']) => new Promise<ServerMessage>((resolve) => waits.push({ type, resolve }));
  if (options.sendHello !== false) { const ready = next('ready'); ws.send(JSON.stringify(hello)); await ready; }
  return { ws, sent, next };
}

test('abort bypasses an in-flight keyframe and sends finish within 50 ms', async () => {
  const models = mockModels(); models.parseScreen = vi.fn(() => new Promise<never>(() => {}));
  const { ws, next } = await socket(models);
  try {
    const ack = next('goal.ack'); ws.send(JSON.stringify({ type: 'goal', id: 'g', ts: 0, source: 'typed', text: 'start' })); await ack;
    ws.send(encodeFrame(frame(), jpeg)); await vi.waitFor(() => expect(models.parseScreen).toHaveBeenCalledTimes(1));
    const finished = next('finish'); ws.send(JSON.stringify({ type: 'abort', id: 'stop', ts: 0 }));
    expect(await within50ms(finished)).toMatchObject({ result: 'aborted' });
  } finally { ws.terminate(); }
});

test('abort discards old queued frames, permits a new goal, and drops the old late target', async () => {
  const models = mockModels(), parse = models.parseScreen, pending = deferred<void>(); let calls = 0;
  models.parseScreen = async (image, options) => { if (++calls === 1) await pending.promise; return parse(image, options); };
  const { ws, next, sent } = await socket(models);
  try {
    const first = next('goal.ack'); ws.send(JSON.stringify({ type: 'goal', id: 'g', ts: 0, source: 'typed', text: 'start' })); await first;
    ws.send(encodeFrame(frame(), jpeg)); await vi.waitFor(() => expect(calls).toBe(1));
    ws.send(encodeFrame(frame('verify', 'old-queued-verify'), jpeg));
    const finish = next('finish'); ws.send(JSON.stringify({ type: 'abort', id: 'stop', ts: 0 })); await within50ms(finish);
    const ack = next('goal.ack'); ws.send(JSON.stringify({ type: 'goal', id: 'new-goal', ts: 0, source: 'typed', text: 'timer' })); await within50ms(ack);
    const target = next('target'); ws.send(encodeFrame(frame('locate', 'new-frame'), jpeg));
    expect(await target).toMatchObject({ elementId: 'e2' });
    pending.resolve(); await new Promise(setImmediate);
    expect(calls).toBe(2); expect(sent.filter((m) => m.type === 'target')).toHaveLength(1);
    expect(sent.some((m) => m.type === 'verify')).toBe(false);
  } finally { pending.resolve(); ws.terminate(); }
});

test('abort releases the socket backlog even while the ASR cloud flag check is stalled', async () => {
  const pending = deferred<boolean>(), getCloudEnabled = vi.fn(() => pending.promise);
  const { ws, next, sent } = await socket(mockModels(), { flagStore: { getCloudEnabled, setCloudEnabled: async () => {} } });
  try {
    ws.send(encodeFrame({ type: 'audio', id: 'a', ts: 0, seq: 0, sampleRate: 16000 }, new Uint8Array(640)));
    await vi.waitFor(() => expect(getCloudEnabled).toHaveBeenCalledTimes(1));
    const finish = next('finish'); ws.send(JSON.stringify({ type: 'abort', id: 'stop', ts: 0 })); await within50ms(finish);
    const ack = next('goal.ack'); ws.send(JSON.stringify({ type: 'goal', id: 'next', ts: 0, source: 'typed', text: 'timer' }));
    expect(await within50ms(ack)).toMatchObject({ goal: 'timer' });
    pending.resolve(false); await new Promise(setImmediate);
    expect(sent.map((m) => m.type)).toEqual(['ready', 'finish', 'goal.ack']);
  } finally { pending.resolve(false); ws.terminate(); }
});

test('hello followed immediately by abort preserves the hello-first handshake', async () => {
  const { ws, sent, next } = await socket(mockModels(), { sendHello: false });
  try {
    const finish = next('finish');
    ws.send(JSON.stringify(hello)); ws.send(JSON.stringify({ type: 'abort', id: 'stop', ts: 0 }));
    await within50ms(finish);
    expect(sent.map((m) => m.type)).toEqual(['ready', 'finish']);
  } finally { ws.terminate(); }
});

test('a buffered hello, goal, stalled keyframe and abort cannot trap cancellation before ready', async () => {
  const models = mockModels(); models.parseScreen = vi.fn(() => new Promise<never>(() => {}));
  const { ws, sent, next } = await socket(models, { sendHello: false });
  try {
    const server = [...app!.websocketServer.clients][0]!, finish = next('finish');
    // Synchronous delivery exercises the buffer drained after asynchronous authentication.
    server.emit('message', Buffer.from(JSON.stringify(hello)), false);
    server.emit('message', Buffer.from(JSON.stringify({ type: 'goal', id: 'g', ts: 0, source: 'typed', text: 'start' })), false);
    server.emit('message', Buffer.from(encodeFrame(frame(), jpeg)), true);
    server.emit('message', Buffer.from(JSON.stringify({ type: 'abort', id: 'stop', ts: 0 })), false);
    expect(await within50ms(finish)).toMatchObject({ result: 'aborted' });
    expect(sent.map((m) => m.type)).toEqual(['ready', 'finish']);
    expect(models.parseScreen).not.toHaveBeenCalled();
  } finally { ws.terminate(); }
});

test('a malformed abort cannot cancel an in-flight target or skip validation', async () => {
  const models = mockModels(), parse = models.parseScreen, pending = deferred<void>();
  models.parseScreen = vi.fn(async (image, options) => { await pending.promise; return parse(image, options); });
  const { ws, sent, next } = await socket(models);
  try {
    const ack = next('goal.ack'); ws.send(JSON.stringify({ type: 'goal', id: 'g', ts: 0, source: 'typed', text: 'start' })); await ack;
    ws.send(encodeFrame(frame(), jpeg)); await vi.waitFor(() => expect(models.parseScreen).toHaveBeenCalledTimes(1));
    ws.send(JSON.stringify({ type: 'abort', id: 'invalid' }));
    const target = next('target'), error = next('error'); pending.resolve(); await target;
    expect(await error).toMatchObject({ code: 'bad_message' });
    expect(sent.some((m) => m.type === 'finish')).toBe(false);
  } finally { pending.resolve(); ws.terminate(); }
});

test('locate retry uploads received during an in-flight parse are not billed again from the socket backlog', async () => {
  const models = mockModels(), original = models.parseScreen, pending = deferred<void>();
  models.parseScreen = vi.fn<ModelPort['parseScreen']>(async (image, options) => { await pending.promise; return original(image, options); });
  const { ws, next } = await socket(models);
  try {
    const ack = next('goal.ack'); ws.send(JSON.stringify({ type: 'goal', id: 'g', ts: 0, source: 'typed', text: 'start' })); await ack;
    ws.send(encodeFrame(frame(), jpeg)); await vi.waitFor(() => expect(models.parseScreen).toHaveBeenCalledOnce());
    ws.send(encodeFrame(frame('locate', 'retry-a'), jpeg)); ws.send(encodeFrame(frame('locate', 'retry-b'), jpeg));
    const barrier = next('goal.ack'); ws.send(JSON.stringify({ type: 'goal', id: 'barrier', ts: 0, source: 'typed', text: 'timer' }));
    await new Promise<void>((resolve) => { ws.once('pong', () => resolve()); ws.ping(); });
    pending.resolve(); await barrier;
    expect(models.parseScreen).toHaveBeenCalledOnce();
  } finally { pending.resolve(); ws.terminate(); }
});

test('coalescing a slow locate preserves a subsequent goal and its fresh keyframe', async () => {
  const models = mockModels(), original = models.parseScreen, pending = deferred<void>(); let calls = 0;
  models.parseScreen = vi.fn<ModelPort['parseScreen']>(async (image, options) => { if (++calls === 1) await pending.promise; return original(image, options); });
  const { ws, next, sent } = await socket(models);
  try {
    const ack = next('goal.ack'); ws.send(JSON.stringify({ type: 'goal', id: 'g', ts: 0, source: 'typed', text: 'start' })); await ack;
    ws.send(encodeFrame(frame(), jpeg)); await vi.waitFor(() => expect(calls).toBe(1));
    ws.send(JSON.stringify({ type: 'goal', id: 'next', ts: 0, source: 'typed', text: 'timer' }));
    ws.send(encodeFrame(frame('locate', 'fresh'), jpeg));
    const barrier = next('goal.ack');
    await new Promise<void>((resolve) => { ws.once('pong', () => resolve()); ws.ping(); });
    pending.resolve(); await barrier;
    await vi.waitFor(() => expect(sent.filter((m) => m.type === 'target')).toHaveLength(2));
    expect(sent.filter((m) => m.type === 'target')).toMatchObject([{ elementId: 'e5' }, { elementId: 'e2' }]);
    expect(models.parseScreen).toHaveBeenCalledTimes(2);
  } finally { pending.resolve(); ws.terminate(); }
});
