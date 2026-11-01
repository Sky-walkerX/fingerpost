import { afterEach, expect, test, vi } from 'vitest';
import OpenAI from 'openai';
import type { FastifyInstance } from 'fastify';
import { encodeFrame, ServerMessage } from '@fingerpost/protocol';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Breaker } from '../src/models/breaker.ts';
import { createMetaClient } from '../src/models/meta-client.ts';
import { liveModels, type ModelPort } from '../src/models/port.ts';
import { mockModels } from '../src/models/mock/mock-models.ts';
import { createRouter, ModelsUnavailable, OFFLINE_SAY } from '../src/models/router.ts';
import { PARSE_PROMPT_ID } from '../src/parse/spark-parse.ts';

const image = { bytes: new Uint8Array([0xff, 0xd8]), mime: 'image/jpeg' as const };
const outage = () => new OpenAI.APIError(503, { message: 'synthetic' }, 'synthetic outage', new Headers());

/** A port whose parse fails `failures` times, then succeeds. Counts calls. */
function flaky(failures: number) {
  const base = mockModels();
  let calls = 0;
  const port: ModelPort = { ...base, parseScreen: async (i, o) => { if (calls++ < failures) throw outage(); return base.parseScreen(i, o); } };
  return { port, calls: () => calls };
}

test('breaker opens after 5 failures', () => {
  let now = 0;
  const b = new Breaker({ now: () => now });
  for (let i = 0; i < 4; i++) { expect(b.allow()).toBe(true); b.failure(); now += 1_000; }
  expect(b.allow()).toBe(true);
  b.failure();
  expect(b.state).toBe('open');
  expect(b.allow()).toBe(false);
  now += 19_999;
  expect(b.allow()).toBe(false);
  now += 1;
  expect(b.allow()).toBe(true);           // half-open: one trial call
  expect(b.allow()).toBe(false);          // …and only one
  b.failure();
  expect(b.state).toBe('open');
  now += 20_000;
  expect(b.allow()).toBe(true);
  b.success();
  expect(b.state).toBe('closed');
});

test('failures older than 30 s do not count toward opening', () => {
  let now = 0;
  const b = new Breaker({ now: () => now });
  for (let i = 0; i < 4; i++) b.failure();
  now += 30_001;
  b.failure();
  expect(b.state).toBe('closed');
});

test('one jittered retry (200–600 ms) recovers a passing blip without opening the breaker', async () => {
  const waits: number[] = [];
  const { port, calls } = flaky(1);
  const router = createRouter({ meta: port, sleep: async (ms) => { waits.push(ms); }, random: () => 0.5 });
  await router.forSession('normal', 'none').parseScreen(image, { locale: 'en' });
  expect(calls()).toBe(2);
  expect(waits).toEqual([400]);
});

test('chain: Meta → warm Glimmer when Meta keeps failing', async () => {
  const { port } = flaky(99);
  const glimmer = mockModels();
  const parse = vi.fn(glimmer.parseScreen);
  const router = createRouter({ meta: port, glimmer: { ...glimmer, parseScreen: parse }, glimmerWarm: () => true, sleep: async () => {} });
  await router.forSession('normal', 'none').parseScreen(image, { locale: 'en' });
  expect(parse).toHaveBeenCalledTimes(1);
});

test('a cold Glimmer is skipped; with the breaker open Meta is not called at all', async () => {
  const { port, calls } = flaky(99);
  const router = createRouter({ meta: port, glimmer: mockModels(), glimmerWarm: () => false, sleep: async () => {} });
  const meta = router.forSession('normal', 'none');
  for (let i = 0; i < 5; i++) await expect(meta.parseScreen(image, { locale: 'en' })).rejects.toBeInstanceOf(ModelsUnavailable);
  const before = calls();
  await expect(meta.parseScreen(image, { locale: 'en' })).rejects.toBeInstanceOf(ModelsUnavailable);
  expect(calls()).toBe(before);
});

test('static system prompt first, with a stable prompt-id header (prompt caching)', async () => {
  let seen: { header: string | null; first: string } | undefined;
  const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    seen = { header: new Headers(init?.headers).get('x-prompt-id'), first: body.messages[0].role };
    return new Response(JSON.stringify({ error: { message: 'stop here' } }), { status: 400, headers: { 'content-type': 'application/json' } });
  });
  await expect(liveModels(createMetaClient('k').withOptions({ fetch, logLevel: 'off' })).parseScreen(image, { locale: 'en' })).rejects.toThrow();
  expect(seen).toEqual({ header: PARSE_PROMPT_ID, first: 'system' });
});

// ── over a real socket ─────────────────────────────────────────────────────────────────────────────────
let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

test('chain ends in offline mode message', async () => {
  const { port } = flaky(99);
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }), { models: port, routerSleep: async () => {} });
  await app.ready();
  const ws = await app.injectWS('/v1/session'), messages: ServerMessage[] = [];
  ws.on('message', (d: Buffer) => messages.push(ServerMessage.parse(JSON.parse(d.toString()))));
  ws.send(JSON.stringify({ type: 'hello', id: 'h1', ts: 1, appVersion: '0.1.0', protocol: 'fp.v1', locale: 'en', mode: 'guide', privacy: 'normal', caps: {} }));
  await vi.waitFor(() => expect(messages.some((m) => m.type === 'ready')).toBe(true));
  ws.send(JSON.stringify({ type: 'goal', id: 'g1', ts: 2, source: 'typed', text: 'press start' }));
  ws.send(encodeFrame({ type: 'keyframe', id: 'k1', ts: 3, kind: 'screen', purpose: 'locate', imageSize: { w: 100, h: 50 }, ocrTokens: [] }, new Uint8Array([0xff, 0xd8])));
  await vi.waitFor(() => expect(messages.some((m) => m.type === 'mode')).toBe(true));
  expect(messages.find((m) => m.type === 'mode')).toMatchObject({ mode: 'offline', reason: OFFLINE_SAY });
  expect(OFFLINE_SAY).toBe('Cloud features are paused; basic mode still works.');
  expect(messages.some((m) => m.type === 'target')).toBe(false);
  ws.terminate();
});
