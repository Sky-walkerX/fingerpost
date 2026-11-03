import { afterEach, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';

let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

test('healthz reports status, version and protocol', async () => {
  app = await buildApp(loadConfig({ MODEL_MODE: 'mock', GIT_SHA: 'abc123', LOG_LEVEL: 'silent' }));
  const r = await app.inject('/healthz');
  expect(r.statusCode).toBe(200);
  expect(r.json()).toEqual({ status: 'ok', version: 'abc123', protocol: 'fp.v1' });
});

test('live mode without META_API_KEY fails with a readable error', () => {
  expect(() => loadConfig({ MODEL_MODE: 'live' })).toThrow(/META_API_KEY/);
});

test('defaults: port 8080, mock mode', () => {
  expect(loadConfig({})).toMatchObject({ PORT: 8080, MODEL_MODE: 'mock', GIT_SHA: 'dev' });
});

test('model timeout defaults to 5 s and cannot exceed the plan', () => {
  expect(loadConfig({}).MODEL_TIMEOUT_MS).toBe(5_000);
  expect(loadConfig({ MODEL_TIMEOUT_MS: '3000' }).MODEL_TIMEOUT_MS).toBe(3_000);
  expect(() => loadConfig({ MODEL_TIMEOUT_MS: '30000' })).toThrow(/MODEL_TIMEOUT_MS/);
  expect(() => loadConfig({ MODEL_TIMEOUT_MS: '5001' })).toThrow(/MODEL_TIMEOUT_MS/);
  expect(() => loadConfig({ MODEL_TIMEOUT_MS: '500' })).toThrow(/MODEL_TIMEOUT_MS/);
  expect(() => loadConfig({ MODEL_TIMEOUT_MS: '90000' })).toThrow(/MODEL_TIMEOUT_MS/);
});

test('agent planner is spark or rules', () => {
  expect(loadConfig({ AGENT_PLANNER: 'rules' }).AGENT_PLANNER).toBe('rules');
  expect(() => loadConfig({ AGENT_PLANNER: 'gpt' })).toThrow(/AGENT_PLANNER/);
});

test('shared memory cannot lower the two-install trust requirement', () => {
  expect(loadConfig({}).MEMORY_MIN_INSTALLS).toBe(2);
  expect(() => loadConfig({ MEMORY_MIN_INSTALLS: '1' })).toThrow(/MEMORY_MIN_INSTALLS/);
});

test('websocket hello → ready over a real socket', async () => {
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }));
  await app.ready();
  const ws = await app.injectWS('/v1/session');
  const reply = new Promise<string>((resolve) => ws.once('message', (d: Buffer) => resolve(d.toString())));
  ws.send(JSON.stringify({ type: 'hello', id: 'c1', ts: 1, appVersion: '0.1.0', protocol: 'fp.v1', locale: 'en', mode: 'auto', privacy: 'normal', caps: {} }));
  expect(JSON.parse(await reply)).toMatchObject({ type: 'ready', quota: { tasksLeft: 30 } });
  ws.terminate();
});
