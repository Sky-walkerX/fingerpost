import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ client: vi.fn(), glimmer: vi.fn(), live: vi.fn(), write: vi.fn() }));
vi.mock('node:fs', async (original) => ({ ...await original<typeof import('node:fs')>(), writeSync: mocks.write }));
vi.mock('@fingerpost/gateway/eval-api', async (original) => ({
  ...await original<typeof import('@fingerpost/gateway/eval-api')>(),
  createGlimmerClient: mocks.client, glimmerModels: mocks.glimmer, liveModels: mocks.live,
}));
import { mockModels } from '@fingerpost/gateway/eval-api';
import { main } from '../src/run.ts';

const GLIMMER = { GLIMMER_URL: 'https://synthetic.modal.run/v1', GLIMMER_TOKEN: 'wk-synthetic:ws-synthetic', GLIMMER_MODEL: 'glimmer' };
const roots: string[] = [];
beforeEach(() => {
  mocks.client.mockReset().mockReturnValue({});
  mocks.glimmer.mockReset().mockReturnValue(mockModels());
  mocks.live.mockReset(); mocks.write.mockReset();
});
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const output = () => { const root = mkdtempSync(join(tmpdir(), 'fingerpost-eval-private-')); roots.push(root); return join(root, 'report.md'); };

test('private mode evaluates with glimmer only and labels the report', async () => {
  const out = output();
  expect(await main(['--set', 'mock-panel', '--mode', 'private', '--out', out], { ...GLIMMER, META_API_KEY: 'synthetic-unused' })).toBe(0);
  expect(mocks.client).toHaveBeenCalledTimes(1);
  expect(mocks.client.mock.calls[0]![0]).toMatchObject(GLIMMER);
  expect(mocks.glimmer).toHaveBeenCalledExactlyOnceWith({}, 'glimmer');
  expect(mocks.live).not.toHaveBeenCalled();
  expect(readFileSync(out, 'utf8')).toContain('private');
});

test('private mode without the GLIMMER_* settings fails before any dataset or model access', async () => {
  const out = output();
  expect(await main(['--set', 'synthetic-missing', '--mode', 'private', '--out', out], { GLIMMER_URL: GLIMMER.GLIMMER_URL })).toBe(2);
  expect(mocks.write).toHaveBeenCalledExactlyOnceWith(2, 'GLIMMER_URL, GLIMMER_TOKEN and GLIMMER_MODEL are needed for --mode private\n');
  expect(mocks.client).not.toHaveBeenCalled();
  expect(existsSync(out)).toBe(false);
});
