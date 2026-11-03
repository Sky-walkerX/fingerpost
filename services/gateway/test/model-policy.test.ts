import { afterEach, expect, test, vi } from 'vitest';
import { createMetaClient } from '../src/models/meta-client.ts';
import { parseScreen } from '../src/parse/spark-parse.ts';

afterEach(() => vi.useRealTimers());
const image = { bytes: new Uint8Array([0xff, 0xd8]), mime: 'image/jpeg' as const };

test('a failed model fetch is attempted once; retries belong to the future router', async () => {
  const fetch = vi.fn(async () => { throw new Error('synthetic connection failure'); });
  const client = createMetaClient('synthetic-key').withOptions({ fetch, logLevel: 'off' });
  await expect(parseScreen(client, image, { locale: 'en' })).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('the actual SDK aborts a pending request at the configured model budget (default 30 s)', async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | undefined;
  const fetch = vi.fn<typeof globalThis.fetch>((_input, init) => new Promise<Response>((_resolve, reject) => {
    signal = init?.signal ?? undefined;
    signal?.addEventListener('abort', () => reject(new DOMException('synthetic timeout', 'AbortError')), { once: true });
  }));
  const client = createMetaClient('synthetic-key').withOptions({ fetch, logLevel: 'off' });
  const work = expect(parseScreen(client, image, { locale: 'en' })).rejects.toThrow();
  await vi.waitFor(() => expect(signal).toBeDefined());
  expect(client.timeout).toBe(30_000);
  await vi.advanceTimersByTimeAsync(29_000);
  expect(signal?.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1_000);
  await work;
  expect(signal?.aborted).toBe(true); expect(fetch).toHaveBeenCalledTimes(1);
});

test('a stricter model budget is allowed', () => {
  expect(createMetaClient('synthetic-key', 3_000).timeout).toBe(3_000);
});

test.each([500, 60_001, Infinity, NaN])('refuses a model budget outside the chosen bounded policy: %s', (timeout) => {
  expect(() => createMetaClient('synthetic-key', timeout)).toThrow(/MODEL_TIMEOUT_MS/);
});
