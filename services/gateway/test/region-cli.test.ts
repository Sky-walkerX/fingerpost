import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ measure: vi.fn(), read: vi.fn() }));
vi.mock('../scripts/region-runner.ts', () => ({ measureFullRegion: mocks.measure }));
vi.mock('node:fs', async (original) => ({ ...await original<typeof import('node:fs')>(), readFileSync: mocks.read }));
import { main } from '../scripts/region-latency.ts';

const env = { DEBUG_TOKEN: 'synthetic-debug-token', LATENCY_GOAL: 'synthetic-private-goal' };
const urls = ['https://first.example', 'https://second.example'];
const timings = { p50: 10, p95: 20 };
const result = (mode: 'mock' | 'live', total = 50) => ({ mode, samples: 20, maskFallbacks: 0,
  rttMs: timings, asrConnectMs: timings, asrReadyMs: timings, sparkMs: timings, samMs: timings,
  keyframeToTargetMs: { p50: total, p95: total + 10 } });
beforeEach(() => { mocks.measure.mockReset(); mocks.read.mockReset(); });
afterEach(() => vi.restoreAllMocks());

test.each([{}, { DEBUG_TOKEN: env.DEBUG_TOKEN }])('missing private prerequisites fail before reading images or opening sockets', async (config) => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(await main(urls, config)).toBe(2);
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.measure).not.toHaveBeenCalled();
});

test.each([[urls[0]!], [urls[0]!, urls[0]!], [...urls, 'https://third.example'], ['https://name:synthetic-private@first.example', urls[1]!]])(
  'requires two distinct credential-free origins before reading private files', async (...args) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await main(args, env)).toBe(1);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.measure).not.toHaveBeenCalled();
  });

test('a failed second region prints no partial comparison or private details', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.read.mockReturnValue(new Uint8Array());
  mocks.measure.mockResolvedValueOnce(result('live')).mockRejectedValueOnce(new Error('synthetic-private-key-and-label'));
  expect(await main(urls, env)).toBe(1);
  expect(log).not.toHaveBeenCalled();
  expect(JSON.stringify(error.mock.calls)).not.toContain('synthetic-private');
});

test('twenty live samples rank actual total latency rather than the phase sums', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  mocks.read.mockReturnValue(new Uint8Array());
  mocks.measure.mockResolvedValueOnce(result('live', 100)).mockResolvedValueOnce(result('live', 50));
  expect(await main(urls, env)).toBe(0);
  const output = JSON.stringify(log.mock.calls);
  expect(output).toContain('Lowest measured keyframe-to-target p50: https://second.example');
  expect(output).toContain('ADR-0003 remains proposed');
  expect(output).not.toContain(env.LATENCY_GOAL);
  expect(output).not.toContain(env.DEBUG_TOKEN);
});

test.each(['mock', 'short'] as const)('%s diagnostics cannot select a region', async (kind) => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  mocks.read.mockReturnValue(new Uint8Array());
  mocks.measure.mockResolvedValue({ ...result(kind === 'mock' ? 'mock' : 'live'), samples: kind === 'short' ? 1 : 20 });
  expect(await main(kind === 'short' ? [...urls, '--n', '1'] : urls, env)).toBe(0);
  const output = JSON.stringify(log.mock.calls);
  expect(output).not.toContain('Lowest measured');
  expect(output).toContain('Diagnostic only');
});

test('equal p50 totals are a tie, not an arbitrary region choice', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  mocks.read.mockReturnValue(new Uint8Array());
  mocks.measure.mockResolvedValue(result('live'));
  expect(await main(urls, env)).toBe(0);
  expect(JSON.stringify(log.mock.calls)).toContain('Equal measured p50');
  expect(JSON.stringify(log.mock.calls)).not.toContain('Lowest measured');
});
