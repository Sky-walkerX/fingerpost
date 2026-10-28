import { afterEach, expect, test, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { encodeFrame } from '@fingerpost/protocol';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { MOCK_LAYOUT, mockModels } from '../src/models/mock/mock-models.ts';

let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; vi.restoreAllMocks(); });
const token = 'synthetic-debug-token';
const image = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 2, 64, 4, 0, 1, 1, 0x11, 0, 0xff, 0xd9]);
const hello = { type: 'hello', id: 'h', ts: 1, appVersion: 'benchmark', protocol: 'fp.v1', locale: 'en', mode: 'guide', privacy: 'normal', caps: {} };
const header = { type: 'keyframe', id: 'f', ts: 2, kind: 'screen', purpose: 'locate', imageSize: { w: 1024, h: 576 }, ocrTokens: [] };

async function targetRequest(goal = 'Start', bytes = image, keyframe = header) {
  await app!.ready();
  const socket = await app!.injectWS('/v1/debug/region-target');
  try {
    const exchange = (payload: string | Uint8Array) => {
      const response = new Promise<string>((resolve) => socket.once('message', (data: Buffer) => resolve(data.toString())));
      socket.send(payload);
      return response.then((text) => JSON.parse(text));
    };
    expect(await exchange(JSON.stringify({ token }))).toMatchObject({ authenticated: true });
    expect(await exchange(JSON.stringify(hello))).toMatchObject({ message: { type: 'ready' } });
    expect(await exchange(JSON.stringify({ type: 'goal', id: 'g', ts: 1, text: goal, source: 'typed' })))
      .toMatchObject({ message: { type: 'goal.ack' } });
    return await exchange(encodeFrame(keyframe, bytes));
  } finally { socket.terminate(); }
}

test('both regional routes are absent when debug access is disabled', async () => {
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }));
  expect((await app.inject({ method: 'POST', url: '/v1/debug/asr-connect' })).statusCode).toBe(404);
  expect((await app.inject('/v1/debug/region-target')).statusCode).toBe(404);
});

test('ASR probe authenticates before invoking the provider and returns only timings/mode', async () => {
  const probe = vi.fn().mockResolvedValue({ connectMs: 10, readyMs: 30 });
  app = await buildApp(loadConfig({ DEBUG_TOKEN: token, LOG_LEVEL: 'silent' }), { asrProbe: probe });
  expect((await app.inject({ method: 'POST', url: '/v1/debug/asr-connect' })).statusCode).toBe(404);
  expect(probe).not.toHaveBeenCalled();
  const response = await app.inject({ method: 'POST', url: '/v1/debug/asr-connect', headers: { 'x-debug-token': token } });
  expect(response.json()).toEqual({ mode: 'mock', connectMs: 10, readyMs: 30 });
});

test('provider errors and invalid timing objects never escape the route', async () => {
  const probe = vi.fn().mockRejectedValueOnce(new Error('synthetic-private-key-and-session'))
    .mockResolvedValueOnce({ connectMs: 40, readyMs: 10 });
  app = await buildApp(loadConfig({ DEBUG_TOKEN: token, LOG_LEVEL: 'silent' }), { asrProbe: probe });
  for (let index = 0; index < 2; index++) {
    const response = await app.inject({ method: 'POST', url: '/v1/debug/asr-connect', headers: { 'x-debug-token': token } });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'measurement_failed' });
  }
});

test('benchmark rejects authentication before accepting an image or invoking models', async () => {
  const models = mockModels();
  const parse = vi.spyOn(models, 'parseScreen');
  app = await buildApp(loadConfig({ DEBUG_TOKEN: token, LOG_LEVEL: 'silent' }), { models });
  await app.ready();
  const socket = await app.injectWS('/v1/debug/region-target');
  const closed = new Promise<number>((resolve) => socket.once('close', (code: number) => resolve(code)));
  socket.send(JSON.stringify({ token: 'synthetic-wrong-token' }));
  expect(await closed).toBe(1008);
  expect(parse).not.toHaveBeenCalled();
});

test('a benchmark connection cannot queue more than its four request frames', async () => {
  app = await buildApp(loadConfig({ DEBUG_TOKEN: token, LOG_LEVEL: 'silent' }));
  await app.ready();
  const socket = await app.injectWS('/v1/debug/region-target');
  try {
    const closed = new Promise<number>((resolve) => {
      const deadline = setTimeout(() => resolve(0), 200);
      socket.once('close', (code: number) => { clearTimeout(deadline); resolve(code); });
    });
    for (let index = 0; index < 5; index++) socket.send(JSON.stringify({ token }));
    expect(await closed).toBe(1008);
  } finally { socket.terminate(); }
});

test('binary keyframe resolves its exact target before SAM and returns a validated target', async () => {
  const models = mockModels();
  const segment = vi.spyOn(models, 'segmentByBox');
  app = await buildApp(loadConfig({ DEBUG_TOKEN: token, LOG_LEVEL: 'silent' }), { models });
  const response = await targetRequest(' ＳＴＡＲＴ! ');
  expect(segment).toHaveBeenCalledWith(expect.objectContaining({ width: 1024, height: 576 }),
    { left: 0.6 * 1024, top: 0.7 * 576, right: 0.9 * 1024, bottom: 0.88 * 576 });
  expect(response).toMatchObject({ message: { type: 'target', elementId: 'e5', say: 'Target ready.' },
    timings: { elements: 5, inputTokens: 0, samRefined: 1 } });
  expect(JSON.stringify(response)).not.toContain('Start');
});

test.each(['missing', 'ambiguous', 'protected', 'sensitive'])('failed %s target selection never becomes a timed target', async (kind) => {
  const layout = structuredClone(MOCK_LAYOUT);
  if (kind === 'ambiguous') layout.elements.push({ ...layout.elements[4]!, id: 'e6' });
  if (kind === 'protected') layout.elements[4]!.role = 'pay';
  if (kind === 'sensitive') layout.screenType = 'pin_pad';
  const models = mockModels(layout);
  const segment = vi.spyOn(models, 'segmentByBox');
  app = await buildApp(loadConfig({ DEBUG_TOKEN: token, LOG_LEVEL: 'silent' }), { models });
  expect(await targetRequest(kind === 'missing' ? 'synthetic-private-missing' : 'Start'))
    .toMatchObject({ message: { type: 'error' } });
  expect(segment).not.toHaveBeenCalled();
});

test('invalid JPEG or mismatched keyframe dimensions are rejected before a model call', async () => {
  const models = mockModels();
  const parse = vi.spyOn(models, 'parseScreen');
  app = await buildApp(loadConfig({ DEBUG_TOKEN: token, LOG_LEVEL: 'silent' }), { models });
  expect(await targetRequest('Start', new Uint8Array([1, 2, 3]))).toMatchObject({ message: { type: 'error' } });
  expect(await targetRequest('Start', image, { ...header, imageSize: { w: 1024, h: 500 } }))
    .toMatchObject({ message: { type: 'error' } });
  expect(parse).not.toHaveBeenCalled();
});

test('SAM absence is explicitly counted while the valid element polygon is used', async () => {
  const models = mockModels();
  models.segmentByBox = async () => ({ polygon: null, confidence: null, latencyMs: 0 });
  app = await buildApp(loadConfig({ DEBUG_TOKEN: token, LOG_LEVEL: 'silent' }), { models });
  expect(await targetRequest()).toMatchObject({ timings: { samRefined: 0 }, message: { type: 'target', polygon: MOCK_LAYOUT.elements[4]!.polygon } });
});

test.each(['parse', 'segment'])('%s model failures cannot leak provider content through the benchmark', async (stage) => {
  const models = mockModels();
  const fail = async (): Promise<never> => { throw new Error('synthetic-private-provider-response-and-key'); };
  if (stage === 'parse') models.parseScreen = fail; else models.segmentByBox = fail;
  app = await buildApp(loadConfig({ DEBUG_TOKEN: token, LOG_LEVEL: 'silent' }), { models });
  const response = await targetRequest();
  expect(response).toMatchObject({ message: { type: 'error', code: 'model_unavailable' } });
  expect(JSON.stringify(response)).not.toContain('synthetic-private');
});
