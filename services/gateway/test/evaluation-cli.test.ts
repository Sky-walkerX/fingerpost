import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ smoke: vi.fn(), measure: vi.fn(), read: vi.fn() }));
vi.mock('../scripts/smoke-runner.ts', () => ({ runSmoke: mocks.smoke }));
vi.mock('../src/models/meta-client.ts', () => ({ createMetaClient: () => ({}) }));
vi.mock('../scripts/latency-runner.ts', async (original) => ({
  ...await original<typeof import('../scripts/latency-runner.ts')>(), measureRegion: mocks.measure,
}));
vi.mock('node:fs', async (original) => ({ ...await original<typeof import('node:fs')>(), readFileSync: mocks.read }));

import { main as smokeMain } from '../scripts/smoke-meta.ts';
import { main as latencyMain } from '../scripts/latency-matrix.ts';

beforeEach(() => { mocks.smoke.mockReset(); mocks.measure.mockReset(); mocks.read.mockReset(); });
afterEach(() => vi.restoreAllMocks());

test('missing smoke credentials stop before model evaluation', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(await smokeMain({})).toBe(2);
  expect(mocks.smoke).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledWith(expect.stringContaining('META_API_KEY missing'));
});

test('smoke SDK errors never expose model output or credentials', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.smoke.mockRejectedValue(new Error('synthetic-private-response-and-key'));
  expect(await smokeMain({ META_API_KEY: 'synthetic-test-key' })).toBe(1);
  expect(error).toHaveBeenCalledWith('Live smoke failed. Check the private dataset, credentials and model availability locally.');
  expect(JSON.stringify(error.mock.calls)).not.toContain('synthetic');
});

test('missing debug credentials stop before private files or network are read', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(await latencyMain(['https://synthetic-region.example'], {})).toBe(2);
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.measure).not.toHaveBeenCalled();
});

test('one failed region cannot print a partial successful comparison', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.read.mockReturnValue(new Uint8Array());
  mocks.measure.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('synthetic-private-response'));
  expect(await latencyMain(['https://first.example', 'https://second.example'], { DEBUG_TOKEN: 'synthetic-test-token' })).toBe(1);
  expect(log).not.toHaveBeenCalled();
  expect(JSON.stringify(error.mock.calls)).not.toContain('synthetic');
});
