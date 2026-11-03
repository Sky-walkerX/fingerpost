import { afterEach, expect, test, vi } from 'vitest';
import OpenAI from 'openai';
import { createMetaClient } from '../src/models/meta-client.ts';
import { segmentByText } from '../src/parse/sam.ts';
import { SessionPipeline } from '../src/session/pipeline.ts';
import { mockModels } from '../src/models/mock/mock-models.ts';
import { createRouter } from '../src/models/router.ts';
import type { ServerMessage } from '@fingerpost/protocol';

afterEach(() => vi.useRealTimers());
const jpeg = new Uint8Array([0xff, 0xd8]);
const frame = { type: 'keyframe', id: 'synthetic', ts: 0, kind: 'screen', purpose: 'locate', imageSize: { w: 1000, h: 500 }, ocrTokens: [] } as const;

test('SAM stream bodies obey the configured deadline even after HTTP headers arrived', async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | undefined;
  const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
    signal = init?.signal ?? undefined;
    return new Response(new ReadableStream<Uint8Array>({ start(controller) {
      signal?.addEventListener('abort', () => controller.error(new DOMException('synthetic abort', 'AbortError')), { once: true });
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
  });
  const client = createMetaClient('synthetic-key', 1000).withOptions({ fetch, logLevel: 'off' });
  const work = expect(segmentByText(client, { bytes: jpeg, width: 1000, height: 500 }, 'touchscreen display')).rejects.toBeInstanceOf(OpenAI.APIConnectionTimeoutError);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(1000);
  expect(signal?.aborted).toBe(true);
  await work;
});

test('a bounded turn cancels models, emits offline once and suppresses late targets', async () => {
  vi.useFakeTimers();
  const models = mockModels(), parse = models.parseScreen;
  let finish!: () => void, signal: AbortSignal | undefined;
  models.parseScreen = vi.fn(async (image, options) => {
    signal = options.signal;
    await new Promise<void>((resolve) => { finish = resolve; });
    return parse(image, options);
  });
  const sent: ServerMessage[] = [], terminal = vi.fn();
  const pipeline = new SessionPipeline({ models, send: (m) => sent.push(m), turnTimeoutMs: 60_000, onTask: () => terminal });
  pipeline.onGoal('start');
  const work = pipeline.onKeyframe({ ...frame, ocrTokens: [] }, jpeg);
  await vi.waitFor(() => expect(models.parseScreen).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(60_000);
  await work;
  expect(signal?.aborted).toBe(true);
  expect(sent.filter((m) => m.type === 'mode')).toMatchObject([{ mode: 'offline' }]);
  expect(terminal).toHaveBeenCalledExactlyOnceWith('error');
  finish(); await Promise.resolve();
  expect(sent.some((m) => m.type === 'target')).toBe(false);
  await pipeline.onKeyframe({ ...frame, ocrTokens: [] }, jpeg);
  expect(models.parseScreen).toHaveBeenCalledOnce();
});

test('abort before the turn deadline never emits an offline response into a new goal', async () => {
  vi.useFakeTimers();
  const models = mockModels(); models.parseScreen = vi.fn(() => new Promise<never>(() => {}));
  const sent: ServerMessage[] = [];
  const pipeline = new SessionPipeline({ models, send: (m) => sent.push(m), turnTimeoutMs: 60_000 });
  pipeline.onGoal('start'); const work = pipeline.onKeyframe({ ...frame, ocrTokens: [] }, jpeg);
  await vi.waitFor(() => expect(models.parseScreen).toHaveBeenCalledOnce());
  pipeline.abort(); pipeline.onGoal('timer'); await work;
  await vi.advanceTimersByTimeAsync(65_000);
  expect(sent.some((m) => m.type === 'mode')).toBe(false);
});

test('the router never starts a retry or a private fallback after cancellation', async () => {
  const controller = new AbortController(), meta = mockModels(), glimmer = mockModels();
  meta.parseScreen = vi.fn(async () => { controller.abort(); throw new OpenAI.APIConnectionError({ message: 'synthetic' }); });
  const privateParse = vi.spyOn(glimmer, 'parseScreen'), sleep = vi.fn(async () => {});
  const route = createRouter({ meta, glimmer, sleep });
  await expect(route.forSession('normal', 'none').parseScreen({ bytes: jpeg, mime: 'image/jpeg' }, { locale: 'en', signal: controller.signal })).rejects.toThrow();
  expect(meta.parseScreen).toHaveBeenCalledOnce(); expect(privateParse).not.toHaveBeenCalled(); expect(sleep).not.toHaveBeenCalled();
});
