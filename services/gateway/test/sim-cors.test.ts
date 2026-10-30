import { afterEach, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';

let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });
const origin = 'http://localhost:5173';
const payload = { runId: 'synthetic-run', screenId: 'home', x: 1, y: 1, u: 0.1, v: 0.1, elementId: 'start', ts: 0 };
const live = { MODEL_MODE: 'live', META_API_KEY: 'synthetic-key', SESSION_SECRET: 'x'.repeat(32), SIGNING_DIGESTS: 'ab'.repeat(32), LOG_LEVEL: 'silent' };

test('browser preflight permits only the simulator POST and its explicit token/content headers', async () => {
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }));
  const response = await app.inject({ method: 'OPTIONS', url: '/v1/sim/events', headers: {
    origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-sim-token',
  } });
  expect(response.statusCode).toBe(204);
  expect(response.headers['access-control-allow-origin']).toBe('*');
  expect(response.headers['access-control-allow-methods']).toBe('POST');
  expect(response.headers['access-control-allow-headers']).toBe('content-type, x-sim-token');
  expect(response.headers['access-control-allow-credentials']).toBeUndefined();
});

test('browser can read simulator success and validation errors without receiving session CORS access', async () => {
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }));
  for (const body of [payload, {}]) {
    const response = await app.inject({ method: 'POST', url: '/v1/sim/events', headers: { origin }, payload: body });
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(response.statusCode).toBe(body === payload ? 200 : 400);
  }
  const health = await app.inject({ url: '/healthz', headers: { origin } });
  expect(health.headers['access-control-allow-origin']).toBeUndefined();
});

test('enabling browser delivery never bypasses the live simulator token', async () => {
  app = await buildApp(loadConfig({ ...live, SIM_TOKEN: 'synthetic-token' }));
  for (const [token, status] of [[undefined, 401], ['incorrect', 401], ['synthetic-token', 200]] as const) {
    const response = await app.inject({ method: 'POST', url: '/v1/sim/events', payload,
      headers: { origin, ...(token ? { 'x-sim-token': token } : {}) } });
    expect(response.statusCode).toBe(status);
    expect(response.headers['access-control-allow-origin']).toBe('*');
  }
});

test('live mode without SIM_TOKEN exposes neither the simulator route nor its preflight', async () => {
  app = await buildApp(loadConfig(live));
  for (const method of ['POST', 'OPTIONS'] as const) {
    const response = await app.inject({ method, url: '/v1/sim/events', headers: { origin } });
    expect(response.statusCode).toBe(404);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  }
});
