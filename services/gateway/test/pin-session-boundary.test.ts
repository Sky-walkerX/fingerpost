import { expect, test, vi } from 'vitest';
import { encodeFrame, type ServerMessage } from '@fingerpost/protocol';
import { createSessionController } from '../src/session/controller.ts';
import { SimRegistry } from '../src/sim/registry.ts';
import { mockModels } from '../src/models/mock/mock-models.ts';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';

const hello = { type: 'hello', id: 'h', ts: 1, appVersion: '0.1.0', protocol: 'fp.v1', locale: 'en',
  mode: 'guide', privacy: 'normal', caps: {} };
const goal = { type: 'goal', id: 'g', ts: 1, text: 'start', source: 'typed' };
const audio = encodeFrame({ type: 'audio', id: 'a', ts: 1, seq: 0, sampleRate: 16000 }, new Uint8Array(640));
const frame = (id = 'k') => encodeFrame({ type: 'keyframe', id, ts: 1, kind: 'screen', purpose: 'locate',
  imageSize: { w: 1000, h: 500 }, ocrTokens: [] }, new Uint8Array([0xff, 0xd8]));
const pin = (entered: boolean) => ({ type: 'event', id: entered ? 'pin-in' : 'pin-out', ts: 1,
  kind: entered ? 'pinModeEntered' : 'pinModeExited' });
function deferred() {
  let resolve!: () => void;
  return { promise: new Promise<void>(r => { resolve = r; }), resolve: () => resolve() };
}
const bounded = async <T>(promise: Promise<T>): Promise<T> => {
  let timer!: ReturnType<typeof setTimeout>;
  try { return await Promise.race([promise, new Promise<never>((_r, reject) => { timer = setTimeout(() => reject(new Error('PIN boundary stalled')), 100); })]); }
  finally { clearTimeout(timer); }
};

test('PIN entry blocks late audio, keyframes and goals until explicit exit', async () => {
  const models = mockModels(), parse = vi.spyOn(models, 'parseScreen'), asr = vi.fn(() => ({ push() {}, end() {}, close() {} }));
  const sent: ServerMessage[] = [];
  const c = createSessionController({ models, asr, sims: new SimRegistry(), send: m => sent.push(m) });
  const text = (m: object) => c.hub.onText(JSON.stringify(m));
  await text(hello); await text(goal); await text(pin(true));
  const n = sent.length;
  await c.hub.onBinary(audio); await c.hub.onBinary(frame()); await text(goal); await text({ type: 'abort', id: 'stop', ts: 1 });
  await c.hub.onBinary(audio); await c.hub.onBinary(frame('late'));
  expect(parse).not.toHaveBeenCalled(); expect(asr).not.toHaveBeenCalled();
  expect(sent.slice(n).some(m => m.type === 'goal.ack' || m.type === 'target')).toBe(false);
  await text(pin(false)); await text(goal); await c.hub.onBinary(frame('new'));
  expect(parse).toHaveBeenCalledTimes(1); c.dispose();
});

test('PIN entry invalidates an outstanding ASR quota check before it opens a relay', async () => {
  let resolve!: (value: boolean) => void;
  const enabled = new Promise<boolean>(r => { resolve = r; });
  const asr = vi.fn(() => ({ push() {}, end() {}, close() {} }));
  const c = createSessionController({ models: mockModels(), asr, sims: new SimRegistry(), send: () => {},
    quota: { cloudEnabled: () => enabled, startTask: async () => ({ ok: true, tasksLeft: 1 }), recordUsage: async () => 0 } });
  await c.hub.onText(JSON.stringify(hello)); const pending = c.hub.onBinary(audio);
  await c.hub.onText(JSON.stringify(pin(true))); resolve(true); await pending;
  expect(asr).not.toHaveBeenCalled(); c.dispose();
});

test('validated PIN entry bypasses a stalled parse, cancels its backlog and suppresses late targets', async () => {
  const pending = deferred(), closed = deferred();
  const models = mockModels(), parse = models.parseScreen; let calls = 0;
  models.parseScreen = vi.fn(async (image, opts) => { if (++calls === 1) await pending.promise; return parse(image, opts); });
  const app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }), { models,
    asr: () => ({ push() {}, end() {}, close: closed.resolve }) });
  await app.ready(); const ws = await app.injectWS('/v1/session'), sent: ServerMessage[] = [];
  ws.on('message', (data: Buffer) => sent.push(JSON.parse(data.toString())));
  const send = (m: object) => ws.send(JSON.stringify(m));
  try {
    send(hello); await vi.waitFor(() => expect(sent.some(m => m.type === 'ready')).toBe(true));
    send(goal); await vi.waitFor(() => expect(sent.some(m => m.type === 'goal.ack')).toBe(true));
    ws.send(audio); ws.send(frame());
    await vi.waitFor(() => expect(calls).toBe(1)); ws.send(frame('backlog')); send(pin(true));
    await bounded(closed.promise);
    send(pin(false)); send({ ...goal, id: 'new', text: 'timer' });
    await vi.waitFor(() => expect(sent.some(m => m.type === 'goal.ack' && m.goal === 'timer')).toBe(true));
    ws.send(frame('current'));
    await vi.waitFor(() => expect(sent.some(m => m.type === 'target' && m.elementId === 'e2')).toBe(true));
    pending.resolve(); await new Promise(setImmediate);
    expect(calls).toBe(2); expect(sent.filter(m => m.type === 'target')).toHaveLength(1);
  } finally { pending.resolve(); ws.terminate(); await app.close(); }
});
