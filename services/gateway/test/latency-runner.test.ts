import { afterEach, expect, test, vi } from 'vitest';
import { measureRegion, parseLatencyArguments } from '../scripts/latency-runner.ts';

const image = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 2, 64, 4, 0, 1, 1, 0x11, 0, 0xff, 0xd9]);
const url = new URL('https://synthetic-region.example');
afterEach(() => vi.restoreAllMocks());

test('parses the documented sample count and HTTPS service URLs', () => {
  expect(parseLatencyArguments([url.href, '--n', '20'])).toEqual({ urls: [url], samples: 20 });
  expect(parseLatencyArguments([url.href]).samples).toBe(20);
});

test.each([
  [], [url.href, '--n', '0'], [url.href, '--n', 'NaN'], [url.href, '--n', '1.5'],
  [url.href, '--n', '21'], [url.href, '--unknown'], [url.href, '--n'],
  ['http://remote.example'], ['https://name:synthetic-private-token@remote.example'],
  ['https://remote.example?synthetic-private-token'], [url.href, '--n', '2', '--n', '3'],
].map((args) => ({ args })))('rejects invalid or credential-bearing arguments', ({ args }) => {
  expect(() => parseLatencyArguments(args)).toThrow('Invalid latency arguments');
});

test('allows local HTTP for offline verification', () => {
  expect(parseLatencyArguments(['http://127.0.0.1:8080', '--n', '1']).samples).toBe(1);
});

test('reports actual parse-and-segment round trip separately from gateway phases', async () => {
  let clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
    clock += init?.method === 'POST' ? 120 : 10;
    return Response.json(init?.method === 'POST' ? { sparkMs: 40, samMs: 60, elements: 2, inputTokens: 8 } : { status: 'ok' });
  });
  expect(await measureRegion(url, image, 'synthetic-debug-token', 2, fetcher)).toEqual({
    samples: 2, rttMs: { p50: 10, p95: 10 }, sparkMs: { p50: 40, p95: 40 },
    samMs: { p50: 60, p95: 60 }, parseAndSegmentRoundTripMs: { p50: 120, p95: 120 },
  });
  for (const call of fetcher.mock.calls) expect(call[1]?.redirect).toBe('error');
});

test.each([401, 404, 429, 500])('HTTP %i never becomes a successful timing sample', async (status) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('synthetic-private-response', { status }));
  await expect(measureRegion(url, image, 'synthetic-debug-token', 2, fetcher)).rejects.toThrow('Regional health check failed');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('failed debug request stops without returning a partial success', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ status: 'ok' }))
    .mockResolvedValueOnce(new Response('synthetic-private-model-error', { status: 503 }));
  await expect(measureRegion(url, image, 'synthetic-debug-token', 2, fetcher)).rejects.toThrow('Regional model measurement failed');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test.each([
  { sparkMs: -1, samMs: 2, elements: 1, inputTokens: 8 },
  { sparkMs: '10', samMs: 2, elements: 1, inputTokens: 8 },
  { sparkMs: 10, elements: 1, inputTokens: 8 },
  { sparkMs: 10, samMs: 20, elements: 1, inputTokens: 8, recognizedText: 'synthetic-private' },
])('validates response metrics without retaining response content', async (body) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ status: 'ok' }))
    .mockResolvedValueOnce(Response.json(body));
  await expect(measureRegion(url, image, 'synthetic-debug-token', 1, fetcher)).rejects.toThrow('Invalid regional latency metrics');
});

test('placeholder sample is rejected before any network request', async () => {
  const fetcher = vi.fn<typeof fetch>();
  await expect(measureRegion(url, new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 'synthetic-debug-token', 1, fetcher))
    .rejects.toThrow('Invalid JPEG dimensions');
  expect(fetcher).not.toHaveBeenCalled();
});
