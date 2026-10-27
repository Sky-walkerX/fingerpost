import { afterEach, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { encodeFrame } from '@fingerpost/protocol';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';

let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

const hello = { type: 'hello', id: 'c1', ts: 1, appVersion: '0.1.0', protocol: 'fp.v1', locale: 'en', mode: 'auto', privacy: 'normal', caps: { simRunId: 'run-9' } };
const keyframe = { type: 'keyframe', id: 'k1', ts: 3, kind: 'screen', imageSize: { w: 1000, h: 500 }, ocrTokens: [], purpose: 'locate' };

async function connect() {
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' })); // MODEL_MODE defaults to mock
  await app.ready();
  const ws = await app.injectWS('/v1/session');
  const got: any[] = [];
  const waiters: Array<[string, (m: any) => void]> = [];
  ws.on('message', (d: Buffer) => {
    const m = JSON.parse(d.toString()); got.push(m);
    for (const [i, [t, r]] of waiters.entries()) if (m.type === t) { waiters.splice(i, 1); r(m); break; }
  });
  const next = (type: string) => { const hit = got.find((m) => m.type === type && !m._seen); if (hit) { hit._seen = true; return Promise.resolve(hit); } return new Promise<any>((r) => waiters.push([type, (m) => { m._seen = true; r(m); }])); };
  return { ws, next, got };
}

test('mock mode end to end: hello → voice goal → keyframe → target', async () => {
  const { ws, next } = await connect();
  ws.send(JSON.stringify(hello));
  await next('ready');
  ws.send(encodeFrame({ type: 'audio', id: 'a1', ts: 2, seq: 0, sampleRate: 16000 }, new Uint8Array(640)));
  ws.send(JSON.stringify({ type: 'audio.end', id: 'a2', ts: 2 }));
  expect((await next('transcript')).final).toBe(false);
  await next('goal.ack');
  ws.send(encodeFrame(keyframe, new Uint8Array([0xff, 0xd8])));
  expect(await next('target')).toMatchObject({ elementId: 'e5', say: 'Found Start, bottom right.' });
  ws.terminate();
});

test('a sim touch for the linked run reaches the session as sim.touch', async () => {
  const { ws, next } = await connect();
  ws.send(JSON.stringify(hello));
  await next('ready');
  const r = await app!.inject({ method: 'POST', url: '/v1/sim/events', payload: { runId: 'run-9', screenId: 'home', x: 640, y: 500, u: 0.5, v: 0.625, elementId: 'start-order', ts: 5 } });
  expect(r.json()).toEqual({ delivered: 1 });
  expect(await next('sim.touch')).toMatchObject({ runId: 'run-9', elementId: 'start-order' });
  ws.terminate();
});

test('sim events: invalid body → 400; unknown run → delivered 0', async () => {
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }));
  expect((await app.inject({ method: 'POST', url: '/v1/sim/events', payload: { runId: 'x' } })).statusCode).toBe(400);
  expect((await app.inject({ method: 'POST', url: '/v1/sim/events', payload: { runId: 'nobody', screenId: 's', x: 0, y: 0, u: 0, v: 0, elementId: null, ts: 1 } })).json()).toEqual({ delivered: 0 });
});

test('SIM_TOKEN, when set, is required', async () => {
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent', SIM_TOKEN: 'secret-123' }));
  const body = { runId: 'r', screenId: 's', x: 0, y: 0, u: 0, v: 0, elementId: null, ts: 1 };
  expect((await app.inject({ method: 'POST', url: '/v1/sim/events', payload: body })).statusCode).toBe(401);
  expect((await app.inject({ method: 'POST', url: '/v1/sim/events', payload: body, headers: { 'x-sim-token': 'secret-123' } })).statusCode).toBe(200);
});
