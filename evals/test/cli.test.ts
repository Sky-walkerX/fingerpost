import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, test } from 'vitest';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function run(args: string[]) {
  const root = mkdtempSync(join(tmpdir(), 'fingerpost-eval-cli-'));
  roots.push(root);
  const out = join(root, 'report.md');
  const result = spawnSync(process.execPath, ['--conditions=source', 'src/run.ts', '--out', out, ...args], {
    // Exercise native Node without inheriting test hooks or real credentials.
    cwd: fileURLToPath(new URL('../', import.meta.url)), env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 10_000,
  });
  return { ...result, out };
}

test('actual native Node CLI produces the mock baseline without source filenames', () => {
  const result = run(['--set', 'mock-panel']);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('"targetHitRate":0.5');
  const report = readFileSync(result.out, 'utf8');
  expect(report).toContain('| Target hit rate | 50.0% |');
  expect(report).not.toContain('panel-a.jpg');
  expect(report).not.toContain('pin-a.jpg');
  expect(report).toContain('sample-001');
});

test('native CLI exports anonymous numeric results with mock provenance retained', () => {
  const root = mkdtempSync(join(tmpdir(), 'fingerpost-numeric-cli-')); roots.push(root);
  const numeric = join(root, 'numeric.json');
  const result = run(['--set', 'mock-panel', '--numeric-out', numeric]);
  expect(result.status).toBe(0);
  const data = JSON.parse(readFileSync(numeric, 'utf8'));
  expect(data.mode).toBe('mock'); expect(data.items).toHaveLength(2);
  expect(data.items[0]).toMatchObject({ id: 'sample-000001', sha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
  expect(JSON.stringify(data)).not.toContain('panel-a');
  expect(JSON.stringify(data)).not.toContain('goal');
});

test.each([
  ['--mode', 'synthetic-private-invalid-mode'],
  ['--limit', '0'], ['--limit', '-1'], ['--limit', 'NaN'], ['--limit', '1.5'],
  ['--unknown', 'synthetic-private-value'],
])('invalid CLI option %j is rejected without producing a misleading report', (...args) => {
  const result = run(['--set', 'mock-panel', ...args]);
  expect(result.status).toBe(2);
  expect(existsSync(result.out)).toBe(false);
  expect(result.stderr).not.toContain('synthetic-private');
  expect(result.stderr).not.toContain('node:');
});

test.each(['../synthetic-private-path', '/tmp/synthetic-private-path', 'https://synthetic-private.example'])('dataset selection stays inside datasets: %s', (dataset) => {
  const result = run(['--set', dataset]);
  expect(result.status).toBe(2);
  expect(result.stderr).not.toContain('synthetic-private');
  expect(result.stderr).not.toContain('node:');
  expect(existsSync(result.out)).toBe(false);
});

test('missing live credentials fail before any dataset or model access', () => {
  const result = run(['--set', 'synthetic-private-missing-dataset', '--mode', 'live']);
  expect(result.status).toBe(2);
  expect(result.stderr.trim()).toBe('META_API_KEY missing (configure the ignored local environment first)');
  expect(existsSync(result.out)).toBe(false);
});

test('filesystem failures produce a fixed content-free error', () => {
  const result = run(['--set', 'synthetic-private-missing-dataset']);
  expect(result.status).toBe(1);
  expect(result.stderr.trim()).toBe('Evaluation failed. Check the local dataset and model availability.');
  expect(existsSync(result.out)).toBe(false);
});
