import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

test('native Node entry refuses missing job configuration before credentials or network setup', () => {
  const run = spawnSync(process.execPath, ['--conditions=source', fileURLToPath(new URL('../src/budget-job.ts', import.meta.url))], {
    env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 5000,
  });
  expect(run.error).toBeUndefined(); expect(run.status).toBe(1);
  expect(run.stdout).toBe(''); expect(run.stderr.trim()).toBe('Budget job failed');
});
