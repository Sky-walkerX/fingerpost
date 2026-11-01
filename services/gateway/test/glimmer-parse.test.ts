import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type OpenAI from 'openai';
import { encodeFrame, Layout, ServerMessage } from '@fingerpost/protocol';
import { buildApp, type AppOverrides } from '../src/app.ts';
import { createGlimmerClient, glimmerModels } from '../src/parse/glimmer-parse.ts';
import { parseScreen } from '../src/parse/spark-parse.ts';
import { loadConfig, privateAvailable } from '../src/config.ts';
import { SessionHub } from '../src/session/hub.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/spark-parse.response.json', import.meta.url), 'utf8'));
const img = { bytes: new Uint8Array([0xff, 0xd8, 0xff]), mime: 'image/jpeg' as const };
const fake = () => {
  const calls: any[] = [];
  const client = { chat: { completions: { create: async (b: unknown) => { calls.push(b); return fixture; } } } } as unknown as OpenAI;
  return { client, calls };
};
const GLIMMER = { GLIMMER_URL: 'https://fingerpost--glimmer-serve.modal.run/v1', GLIMMER_TOKEN: 'wk-synthetic:ws-synthetic', GLIMMER_MODEL: 'glimmer' };

test('glimmer parse reuses the Spark schema and layout mapping with the Glimmer model id', async () => {
  const { client, calls } = fake();
  const r = await glimmerModels(client, 'glimmer').parseScreen(img, { locale: 'hi', goal: 'pay' });
  expect(calls).toHaveLength(1);
  expect(calls[0].model).toBe('glimmer');
  expect(calls[0].response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'screen_layout', strict: true } });
  const spark = await parseScreen(fake().client, img, { locale: 'hi', goal: 'pay' });
  expect(r.layout).toEqual(spark.layout);
  expect(Layout.safeParse({ type: 'layout', id: 'x', ts: 1, fingerprint: '', source: 'model', ...r.layout }).success).toBe(true);
});

test('glimmer has no SAM: segment calls return no polygon and never call the model', async () => {
  const { client, calls } = fake();
  const port = glimmerModels(client, 'glimmer');
  const image = { bytes: img.bytes, width: 10, height: 10 };
  expect(await port.segmentByBox(image, { left: 0, top: 0, right: 5, bottom: 5 })).toEqual({ polygon: null, confidence: null, latencyMs: 0 });
  expect(await port.segmentByText(image, 'touchscreen display')).toEqual({ polygon: null, confidence: null, latencyMs: 0 });
  expect(calls).toHaveLength(0);
});

test('glimmer client calls the configured Modal URL with proxy-auth headers and no SDK retries', async () => {
  const seen: { url: string; headers: Headers }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), headers: new Headers(init?.headers) });
    return new Response(JSON.stringify(fixture), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const cfg = loadConfig(GLIMMER);
  const client = createGlimmerClient(cfg, fetchImpl);
  expect(client.maxRetries).toBe(0);
  expect(client.timeout).toBe(cfg.MODEL_TIMEOUT_MS);
  await glimmerModels(client, cfg.GLIMMER_MODEL!).parseScreen(img, { locale: 'en' });
  expect(seen).toHaveLength(1);
  expect(seen[0]!.url).toBe('https://fingerpost--glimmer-serve.modal.run/v1/chat/completions');
  expect(seen[0]!.headers.get('modal-key')).toBe('wk-synthetic');
  expect(seen[0]!.headers.get('modal-secret')).toBe('ws-synthetic');
});

test('private mode is available only when all three GLIMMER_* values are set', () => {
  expect(privateAvailable(loadConfig({}))).toBe(false);
  expect(privateAvailable(loadConfig(GLIMMER))).toBe(true);
  for (const missing of Object.keys(GLIMMER)) {
    const partial: Record<string, string> = { ...GLIMMER };
    delete partial[missing];
    expect(() => loadConfig(partial)).toThrow(/GLIMMER/);
  }
});

test('glimmer config rejects plain http to a remote host and a token without key:secret', () => {
  expect(() => loadConfig({ ...GLIMMER, GLIMMER_URL: 'http://example.com/v1' })).toThrow(/GLIMMER_URL/);
  expect(loadConfig({ ...GLIMMER, GLIMMER_URL: 'http://127.0.0.1:8000/v1' }).GLIMMER_URL).toBe('http://127.0.0.1:8000/v1');
  expect(() => loadConfig({ ...GLIMMER, GLIMMER_TOKEN: 'just-one-part' })).toThrow(/GLIMMER_TOKEN/);
});

test('ready reports privateAvailable from the router', async () => {
  for (const available of [false, true]) {
    const sent: ServerMessage[] = [];
    const hub = new SessionHub({ send: (m) => sent.push(m), privateAvailable: available });
    await hub.onText(readFileSync(new URL('../../../packages/protocol/fixtures/valid/client.hello.json', import.meta.url), 'utf8'));
    expect(sent[0]).toMatchObject({ type: 'ready', flags: { privateAvailable: available } });
  }
});

// ── over a real socket ─────────────────────────────────────────────────────────────────────────────────
let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

async function privateSession(env: Record<string, string>, overrides: AppOverrides) {
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent', ...env }), overrides); await app.ready();
  const ws = await app.injectWS('/v1/session'), messages: ServerMessage[] = [];
  ws.on('message', (d: Buffer) => messages.push(ServerMessage.parse(JSON.parse(d.toString()))));
  ws.send(JSON.stringify({ type: 'hello', id: 'h1', ts: 1, appVersion: '0.1.0', protocol: 'fp.v1', locale: 'en', mode: 'guide', privacy: 'private', caps: {} }));
  await vi.waitFor(() => expect(messages.some((m) => m.type === 'ready')).toBe(true));
  ws.send(JSON.stringify({ type: 'goal', id: 'g1', ts: 2, source: 'typed', text: 'press cancel' }));
  ws.send(encodeFrame({ type: 'keyframe', id: 'k1', ts: 3, kind: 'screen', purpose: 'locate', imageSize: { w: 100, h: 50 }, ocrTokens: [] }, new Uint8Array([0xff, 0xd8])));
  return { ws, messages };
}

test('a private session parses with the glimmer adapter and guides with its box (no SAM, no meta)', async () => {
  const meta: string[] = [], { client, calls } = fake();
  const metaSpy = { parseScreen: async () => { meta.push('parse'); throw new Error('meta must not be called'); },
    segmentByBox: async () => { meta.push('box'); throw new Error('meta must not be called'); },
    segmentByText: async () => { meta.push('text'); throw new Error('meta must not be called'); } };
  const { ws, messages } = await privateSession({}, { models: metaSpy, glimmer: glimmerModels(client, 'glimmer') });
  await vi.waitFor(() => expect(messages.some((m) => m.type === 'target')).toBe(true));
  expect(messages.find((m) => m.type === 'ready')).toMatchObject({ flags: { privateAvailable: true } });
  expect(meta).toEqual([]);
  expect(calls.map((c) => c.model)).toEqual(['glimmer']);
  const layout = messages.find((m) => m.type === 'layout');
  const target = messages.find((m) => m.type === 'target');
  const cancel = layout?.type === 'layout' ? layout.elements.find((e) => e.label === 'Cancel') : undefined;
  expect(target).toMatchObject({ elementId: cancel?.id, polygon: cancel?.polygon });
  ws.terminate();
});

test('mock mode never builds a live glimmer client, even when GLIMMER_* is set', async () => {
  const { ws, messages } = await privateSession(GLIMMER, {});
  await vi.waitFor(() => expect(messages.some((m) => m.type === 'error')).toBe(true));
  expect(messages.find((m) => m.type === 'ready')).toMatchObject({ flags: { privateAvailable: false } });
  expect(messages.find((m) => m.type === 'mode')).toMatchObject({ mode: 'private' });
  ws.terminate();
});
