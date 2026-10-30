import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ create: vi.fn(), live: vi.fn(), parse: vi.fn(), write: vi.fn() }));
vi.mock('node:fs', async (original) => ({ ...await original<typeof import('node:fs')>(), writeSync: mocks.write }));
vi.mock('@fingerpost/gateway/eval-api', async (original) => ({
  ...await original<typeof import('@fingerpost/gateway/eval-api')>(),
  createMetaClient: mocks.create, liveModels: mocks.live,
}));
import { mockModels } from '@fingerpost/gateway/eval-api';
import { main } from '../src/run.ts';

const roots: string[] = [];
beforeEach(() => {
  mocks.create.mockReset().mockReturnValue({});
  mocks.live.mockReset(); mocks.parse.mockReset();
  mocks.write.mockReset();
  const models = mockModels(); models.parseScreen = mocks.parse;
  mocks.live.mockReturnValue(models);
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function output() {
  const root = mkdtempSync(join(tmpdir(), 'fingerpost-eval-errors-'));
  roots.push(root);
  return join(root, 'report.md');
}

test('provider failure is redacted after reaching the actual live-model branch', async () => {
  const out = output();
  mocks.parse.mockRejectedValue(new Error('synthetic-private-response-image-label-key'));
  expect(await main(['--set', 'mock-panel', '--mode', 'live', '--out', out], { META_API_KEY: 'synthetic-private-key' })).toBe(1);
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith('synthetic-private-key');
  expect(mocks.live).toHaveBeenCalledTimes(1);
  expect(mocks.parse).toHaveBeenCalledTimes(1);
  expect(mocks.write).toHaveBeenCalledExactlyOnceWith(2, 'Evaluation failed. Check the local dataset and model availability.\n');
  expect(existsSync(out)).toBe(false);
});

test('full dataset preflight rejects missing inputs before creating a paid client', async () => {
  const out = output();
  expect(await main(['--set', 'synthetic-missing', '--mode', 'live', '--out', out], { META_API_KEY: 'synthetic-test-key' })).toBe(1);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.live).not.toHaveBeenCalled();
  expect(mocks.parse).not.toHaveBeenCalled();
  expect(existsSync(out)).toBe(false);
});
