import { expect, test, vi } from 'vitest';
import { createMetaClient } from '../src/models/meta-client.ts';
import { liveModels, SPARK_HEDGE_MS } from '../src/models/port.ts';
import { MODEL_TIMEOUT_DEFAULT_MS } from '../src/config.ts';

type Behaviour = { delayMs: number; label: string } | 'hang' | 503 | 400;
const image = { bytes: new Uint8Array([0xff, 0xd8]), mime: 'image/jpeg' as const };

function completion(model: string, label: string) {
  const content = JSON.stringify({ screen_type: 'appliance', sensitivity: 'none', language: 'en', rotation: 0, elements: [
    { label, label_local: null, role: 'button', state: null, bbox: { x_min: 600, y_min: 700, x_max: 900, y_max: 880 }, confidence: 0.9 }] });
  return new Response(JSON.stringify({ id: 'x', object: 'chat.completion', created: 0, model,
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200, headers: { 'content-type': 'application/json' } });
}

/** Per-model synthetic provider: records start order and which requests were cancelled. */
function provider(behaviour: Record<'muse-spark-1.3' | 'muse-spark-1.2', Behaviour>) {
  const started: string[] = [], aborted: string[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>((_url, init) => {
    const model = JSON.parse(String(init?.body)).model as 'muse-spark-1.3' | 'muse-spark-1.2';
    started.push(model);
    const b = behaviour[model];
    return new Promise<Response>((resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { aborted.push(model); reject(new DOMException('cancelled', 'AbortError')); });
      if (b === 'hang') return;
      if (typeof b === 'number') { resolve(new Response(JSON.stringify({ error: { message: 'synthetic' } }), { status: b, headers: { 'content-type': 'application/json' } })); return; }
      setTimeout(() => resolve(completion(model, b.label)), b.delayMs);
    });
  });
  const client = createMetaClient('synthetic-key', 10_000).withOptions({ fetch, logLevel: 'off' });
  return { client, started, aborted };
}

test('a slow Spark 1.3 parse starts Spark 1.2 at the hedge delay and the first answer wins', async () => {
  const p = provider({ 'muse-spark-1.3': 'hang', 'muse-spark-1.2': { delayMs: 10, label: 'From 1.2' } });
  const began = performance.now();
  const result = await liveModels(p.client, { hedgeMs: 40 }).parseScreen(image, { locale: 'en' });
  expect(result.layout.elements[0]!.label).toBe('From 1.2');
  expect(p.started).toEqual(['muse-spark-1.3', 'muse-spark-1.2']);
  expect(p.aborted).toEqual(['muse-spark-1.3']);
  expect(performance.now() - began).toBeLessThan(2_000);
});

test('a parse that answers before the hedge delay makes exactly one request', async () => {
  const p = provider({ 'muse-spark-1.3': { delayMs: 5, label: 'From 1.3' }, 'muse-spark-1.2': { delayMs: 5, label: 'From 1.2' } });
  const result = await liveModels(p.client, { hedgeMs: 200 }).parseScreen(image, { locale: 'en' });
  expect(result.layout.elements[0]!.label).toBe('From 1.3');
  await new Promise((r) => setTimeout(r, 250));
  expect(p.started).toEqual(['muse-spark-1.3']);
});

test('Spark 1.3 still wins when it answers first after the hedge started; 1.2 is cancelled', async () => {
  const p = provider({ 'muse-spark-1.3': { delayMs: 80, label: 'From 1.3' }, 'muse-spark-1.2': 'hang' });
  const result = await liveModels(p.client, { hedgeMs: 20 }).parseScreen(image, { locale: 'en' });
  expect(result.layout.elements[0]!.label).toBe('From 1.3');
  expect(p.started).toEqual(['muse-spark-1.3', 'muse-spark-1.2']);
  expect(p.aborted).toEqual(['muse-spark-1.2']);
});

test('a 5xx before the hedge still falls back immediately; a 4xx before the hedge still fails without 1.2', async () => {
  const fast = provider({ 'muse-spark-1.3': 503, 'muse-spark-1.2': { delayMs: 1, label: 'From 1.2' } });
  const began = performance.now();
  expect((await liveModels(fast.client, { hedgeMs: 5_000 }).parseScreen(image, { locale: 'en' })).layout.elements[0]!.label).toBe('From 1.2');
  expect(performance.now() - began).toBeLessThan(2_000);
  const bad = provider({ 'muse-spark-1.3': 400, 'muse-spark-1.2': { delayMs: 1, label: 'From 1.2' } });
  await expect(liveModels(bad.client, { hedgeMs: 5_000 }).parseScreen(image, { locale: 'en' })).rejects.toThrow();
  expect(bad.started).toEqual(['muse-spark-1.3']);
});

test('when both hedged requests fail the parse rejects', async () => {
  const p = provider({ 'muse-spark-1.3': 503, 'muse-spark-1.2': 503 });
  await expect(liveModels(p.client, { hedgeMs: 5 }).parseScreen(image, { locale: 'en' })).rejects.toThrow();
  expect(p.started).toEqual(['muse-spark-1.3', 'muse-spark-1.2']);
});

test('cancelling the turn cancels both in-flight requests and rejects with the turn reason', async () => {
  const p = provider({ 'muse-spark-1.3': 'hang', 'muse-spark-1.2': 'hang' });
  const turn = new AbortController();
  const parse = liveModels(p.client, { hedgeMs: 10 }).parseScreen(image, { locale: 'en', signal: turn.signal });
  await vi.waitFor(() => expect(p.started).toHaveLength(2));
  const reason = new Error('turn deadline');
  turn.abort(reason);
  await expect(parse).rejects.toBe(reason);
  expect(p.aborted.sort()).toEqual(['muse-spark-1.2', 'muse-spark-1.3']);
});

test('guidance-spec §8: the default hedge starts well inside the per-call bound', () => {
  expect(SPARK_HEDGE_MS).toBe(15_000);
  expect(SPARK_HEDGE_MS).toBeLessThan(MODEL_TIMEOUT_DEFAULT_MS);
});

test('the parse reasoning effort is omitted by default and sent to both Spark versions when configured', async () => {
  const bodies: Record<string, unknown>[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
    const body = JSON.parse(String(init?.body)); bodies.push(body);
    if (body.model === 'muse-spark-1.3') return new Response('{"error":{"message":"synthetic"}}', { status: 503, headers: { 'content-type': 'application/json' } });
    return completion(body.model, 'From 1.2');
  });
  const client = createMetaClient('synthetic-key', 10_000).withOptions({ fetch, logLevel: 'off' });
  await liveModels(client).parseScreen(image, { locale: 'en' });
  expect(bodies.map((b) => 'reasoning_effort' in b)).toEqual([false, false]);
  bodies.length = 0;
  await liveModels(client, { parseReasoning: 'low' }).parseScreen(image, { locale: 'en' });
  expect(bodies.map((b) => b.reasoning_effort)).toEqual(['low', 'low']);
});
