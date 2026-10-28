import { afterEach, expect, test, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { mockModels } from '../src/models/mock/mock-models.ts';

let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });
const token = 'synthetic-debug-token';
const image = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 2, 64, 4, 0, 1, 1, 0x11, 0, 0xff, 0xd9]);

test('debug route is absent without a configured token', async () => {
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }));
  expect((await app.inject({ method: 'POST', url: '/v1/debug/latency' })).statusCode).toBe(404);
});

test('unauthorized requests do not invoke models', async () => {
  const models = mockModels();
  const parse = vi.spyOn(models, 'parseScreen');
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent', DEBUG_TOKEN: token }), { models });
  const response = await app.inject({ method: 'POST', url: '/v1/debug/latency',
    headers: { 'content-type': 'image/jpeg', 'x-debug-token': 'wrong-token' }, payload: image });
  expect(response.statusCode).toBe(404);
  expect(parse).not.toHaveBeenCalled();
});

test.each([Buffer.from([0xff, 0xd8, 0xff, 0xd9]), Buffer.from([1, 2, 3])])('rejects invalid JPEG dimensions before model calls', async (payload) => {
  const models = mockModels();
  const parse = vi.spyOn(models, 'parseScreen');
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent', DEBUG_TOKEN: token }), { models });
  const response = await app.inject({ method: 'POST', url: '/v1/debug/latency',
    headers: { 'content-type': 'image/jpeg', 'x-debug-token': token }, payload });
  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ error: 'invalid_sample' });
  expect(parse).not.toHaveBeenCalled();
});

test('rejects samples over the protocol keyframe limit', async () => {
  const models = mockModels();
  const parse = vi.spyOn(models, 'parseScreen');
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent', DEBUG_TOKEN: token }), { models });
  expect((await app.inject({ method: 'POST', url: '/v1/debug/latency',
    headers: { 'content-type': 'image/jpeg', 'x-debug-token': token }, payload: Buffer.alloc(409_601) })).statusCode).toBe(413);
  expect(parse).not.toHaveBeenCalled();
});

test('model failures produce a content-free error response', async () => {
  const models = mockModels();
  models.parseScreen = async () => { throw new Error('synthetic-private-recognized-text-and-key'); };
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent', DEBUG_TOKEN: token }), { models });
  const response = await app.inject({ method: 'POST', url: '/v1/debug/latency',
    headers: { 'content-type': 'image/jpeg', 'x-debug-token': token }, payload: image });
  expect(response.statusCode).toBe(503);
  expect(response.json()).toEqual({ error: 'model_unavailable' });
  expect(response.body).not.toContain('synthetic-private');
});

test('successful measurement returns only numerical metrics', async () => {
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent', DEBUG_TOKEN: token }));
  const response = await app.inject({ method: 'POST', url: '/v1/debug/latency',
    headers: { 'content-type': 'image/jpeg', 'x-debug-token': token }, payload: image });
  expect(response.statusCode).toBe(200);
  const metrics: Record<string, number> = response.json();
  expect(Object.keys(metrics).sort()).toEqual(['elements', 'inputTokens', 'samMs', 'sparkMs']);
  expect(Object.values(metrics).every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
});
