import { afterEach, expect, test, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { encodeFrame, ServerMessage } from '@fingerpost/protocol';
import { buildApp, type AppOverrides } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { mockModels } from '../src/models/mock/mock-models.ts';

let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });
const hello = { type: 'hello', id: 'h1', ts: 1, appVersion: '0.1.0', protocol: 'fp.v1', locale: 'en', mode: 'guide', privacy: 'normal', caps: { simRunId: 'synthetic-run' } };
const keyframe = (id: string, purpose: 'locate' | 'verify') => encodeFrame({ type: 'keyframe', id, ts: 3, kind: 'screen', purpose, imageSize: { w: 1000, h: 500 }, ocrTokens: [] }, new Uint8Array([0xff, 0xd8]));
async function connect(overrides: AppOverrides = {}) {
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }), overrides); await app.ready();
  const ws = await app.injectWS('/v1/session'), messages: ServerMessage[] = [];
  ws.on('message', (data: Buffer) => messages.push(ServerMessage.parse(JSON.parse(data.toString()))));
  const next = async (type: ServerMessage['type'], count = 1) => {
    await vi.waitFor(() => expect(messages.filter((message) => message.type === type).length).toBeGreaterThanOrEqual(count));
    return messages.filter((message) => message.type === type)[count - 1]!;
  };
  ws.send(JSON.stringify(hello)); await next('ready'); return { ws, messages, next };
}

test('mock voice, locate, target and linked simulator press complete verification', async () => {
  const { ws, next } = await connect();
  ws.send(encodeFrame({ type: 'audio', id: 'a1', ts: 2, seq: 0, sampleRate: 16000 }, new Uint8Array(640)));
  ws.send(JSON.stringify({ type: 'audio.end', id: 'end1', ts: 2 })); await next('goal.ack');
  ws.send(keyframe('k1', 'locate')); expect(await next('target')).toMatchObject({ elementId: 'e5' });
  const posted = await app!.inject({ method: 'POST', url: '/v1/sim/events', payload: { runId: 'synthetic-run', screenId: 'home', x: 1, y: 1, u: 0.1, v: 0.1, elementId: 'start', ts: 4 } });
  expect(posted.json()).toEqual({ delivered: 1 }); await next('sim.touch');
  ws.send(keyframe('k2', 'verify')); expect(await next('verify')).toMatchObject({ re: 'k2', result: 'ok', say: 'Done.' });
  ws.terminate();
});

test('a verify arriving during locate waits for its model result and cannot overtake it', async () => {
  const models = mockModels(), parse = models.parseScreen;
  let release!: () => void, calls = 0, active = 0, maximum = 0;
  const first = new Promise<void>((resolve) => { release = resolve; });
  models.parseScreen = async (image, options) => {
    calls++; active++; maximum = Math.max(maximum, active);
    try { if (calls === 1) await first; return await parse(image, options); } finally { active--; }
  };
  const { ws, messages, next } = await connect({ models });
  const socket = [...app!.websocketServer.clients][0]!;
  let received = 0; socket.on('message', (_data, binary) => { if (binary) received++; });
  ws.send(JSON.stringify({ type: 'goal', id: 'g1', ts: 2, source: 'typed', text: 'start' })); await next('goal.ack');
  ws.send(keyframe('k1', 'locate')); await vi.waitFor(() => expect(calls).toBe(1));
  ws.send(keyframe('k2', 'verify')); await vi.waitFor(() => expect(received).toBe(2));
  expect(calls).toBe(1); release(); await next('verify');
  expect(maximum).toBe(1); expect(messages.filter((message) => ['layout', 'target', 'verify'].includes(message.type)).map(({ type }) => type))
    .toEqual(['layout', 'target', 'layout', 'verify']);
  ws.terminate();
});
