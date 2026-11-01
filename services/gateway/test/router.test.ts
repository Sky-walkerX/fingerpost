import { afterEach, expect, test, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { encodeFrame, ServerMessage } from '@fingerpost/protocol';
import { buildApp, type AppOverrides } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { createMetaClient } from '../src/models/meta-client.ts';
import { liveModels, type ModelPort } from '../src/models/port.ts';
import { MOCK_LAYOUT, mockModels } from '../src/models/mock/mock-models.ts';
import { createRouter, PrivateUnavailable } from '../src/models/router.ts';

/** A mock port that records every call, so a test can prove a provider was never touched. */
function spy(name: string, calls: string[]): ModelPort {
  const base = mockModels();
  return {
    parseScreen: async (i, o) => { calls.push(`${name}.parse`); return base.parseScreen(i, o); },
    segmentByBox: async (i, b) => { calls.push(`${name}.box`); return base.segmentByBox(i, b); },
    segmentByText: async (i, p) => { calls.push(`${name}.text`); return base.segmentByText(i, p); },
  };
}
const image = { bytes: new Uint8Array([0xff, 0xd8]), mime: 'image/jpeg' as const };

test('private session never calls meta', async () => {
  const calls: string[] = [];
  const router = createRouter({ meta: spy('meta', calls), glimmer: spy('glimmer', calls) });
  const port = router.forSession('private', 'none');
  await port.parseScreen(image, { locale: 'en' });
  await port.segmentByBox({ ...image, width: 10, height: 10 }, { left: 0, top: 0, right: 5, bottom: 5 });
  expect(calls).toEqual(['glimmer.parse', 'glimmer.box']);
  expect(() => createRouter({ meta: spy('meta', calls) }).forSession('private', 'none')).toThrow(PrivateUnavailable);
});

test('financial layout switches later frames to glimmer', async () => {
  const calls: string[] = [];
  const meta = spy('meta', calls), glimmer = spy('glimmer', calls);
  const router = createRouter({ meta, glimmer });
  await router.forSession('normal', 'none').parseScreen(image, { locale: 'en' });
  expect(calls).toEqual(['meta.parse']);
  expect(router.forSession('normal', 'financial')).toBe(glimmer);
  expect(router.forSession('normal', 'identity')).toBe(glimmer);
  expect(router.privateAvailable).toBe(true);
});

test('without glimmer a sensitive screen stays on meta (the PIN gate is local); only a private session refuses', async () => {
  const calls: string[] = [];
  const meta = spy('meta', calls);
  const router = createRouter({ meta });
  expect(router.privateAvailable).toBe(false);
  await router.forSession('normal', 'financial').parseScreen(image, { locale: 'en' });
  expect(calls).toEqual(['meta.parse']);
  expect(() => router.forSession('private', 'financial')).toThrow(PrivateUnavailable);
});

/** A fetch that answers per model id: lets the real SDK client exercise the Spark 1.3 → 1.2 fallback. */
function sparkFetch(first: 'timeout' | 503 | 400, seen: string[]) {
  const ok = JSON.stringify({ screen_type: 'appliance', sensitivity: 'none', language: 'en', rotation: 0, elements: [
    { label: 'Start', label_local: null, role: 'button', state: null, bbox: { x_min: 600, y_min: 700, x_max: 900, y_max: 880 }, confidence: 0.9 }] });
  return vi.fn<typeof globalThis.fetch>(async (_url, init) => {
    const model = JSON.parse(String(init?.body)).model as string;
    seen.push(model);
    if (model === 'muse-spark-1.3') {
      if (first === 'timeout') return new Promise<Response>((_r, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('t', 'AbortError'))));
      return new Response(JSON.stringify({ error: { message: 'synthetic' } }), { status: first, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ id: 'x', object: 'chat.completion', created: 0, model, choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: ok } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
}

test('spark 1.3 timeout falls back to 1.2 once', async () => {
  const seen: string[] = [];
  const client = createMetaClient('synthetic-key', 1_000).withOptions({ fetch: sparkFetch('timeout', seen), logLevel: 'off' });
  const result = await liveModels(client).parseScreen(image, { locale: 'en' });
  expect(seen).toEqual(['muse-spark-1.3', 'muse-spark-1.2']);
  expect(result.layout.elements[0]!.label).toBe('Start');
});

test('spark 1.3 5xx falls back to 1.2; a 4xx does not', async () => {
  const seen: string[] = [];
  await liveModels(createMetaClient('k').withOptions({ fetch: sparkFetch(503, seen), logLevel: 'off' })).parseScreen(image, { locale: 'en' });
  expect(seen).toEqual(['muse-spark-1.3', 'muse-spark-1.2']);
  const bad: string[] = [];
  await expect(liveModels(createMetaClient('k').withOptions({ fetch: sparkFetch(400, bad), logLevel: 'off' })).parseScreen(image, { locale: 'en' })).rejects.toThrow();
  expect(bad).toEqual(['muse-spark-1.3']);
});

// ── over a real socket ─────────────────────────────────────────────────────────────────────────────────
let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

async function session(privacy: 'normal' | 'private', overrides: AppOverrides) {
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }), overrides); await app.ready();
  const ws = await app.injectWS('/v1/session'), messages: ServerMessage[] = [];
  ws.on('message', (d: Buffer) => messages.push(ServerMessage.parse(JSON.parse(d.toString()))));
  ws.send(JSON.stringify({ type: 'hello', id: 'h1', ts: 1, appVersion: '0.1.0', protocol: 'fp.v1', locale: 'en', mode: 'guide', privacy, caps: {} }));
  await vi.waitFor(() => expect(messages.some((m) => m.type === 'ready')).toBe(true));
  ws.send(JSON.stringify({ type: 'goal', id: 'g1', ts: 2, source: 'typed', text: 'press start' }));
  ws.send(encodeFrame({ type: 'keyframe', id: 'k1', ts: 3, kind: 'screen', purpose: 'locate', imageSize: { w: 100, h: 50 }, ocrTokens: [] }, new Uint8Array([0xff, 0xd8])));
  return { ws, messages };
}

test('PrivateUnavailable becomes mode{private} + spoken error', async () => {
  const calls: string[] = [];
  const { ws, messages } = await session('private', { models: spy('meta', calls) });
  await vi.waitFor(() => expect(messages.some((m) => m.type === 'error')).toBe(true));
  expect(messages.find((m) => m.type === 'mode')).toMatchObject({ mode: 'private' });
  expect(messages.find((m) => m.type === 'error')).toMatchObject({ code: 'model_unavailable', retryable: false });
  expect(calls).toEqual([]);
  expect(messages.some((m) => m.type === 'layout' || m.type === 'target')).toBe(false);
  ws.terminate();
});

test('a private session with glimmer configured reads the screen with glimmer only', async () => {
  const calls: string[] = [];
  const { ws, messages } = await session('private', { models: spy('meta', calls), glimmer: spy('glimmer', calls) });
  await vi.waitFor(() => expect(messages.some((m) => m.type === 'target')).toBe(true));
  expect(calls.every((c) => c.startsWith('glimmer.'))).toBe(true);
  expect(messages.find((m) => m.type === 'layout')).toMatchObject({ elements: expect.arrayContaining([expect.objectContaining({ label: MOCK_LAYOUT.elements[4]!.label })]) });
  ws.terminate();
});
