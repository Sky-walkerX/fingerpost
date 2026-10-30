import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

test('Node can load the source gateway and live startup dependencies without a TS transformer', () => {
  const result = spawnSync(process.execPath, ['--conditions=source', '--input-type=module', '-e', `
    import { buildApp } from './src/app.ts';
    import { loadConfig } from './src/config.ts';
    import './src/auth/revocation.ts';
    import './src/quota/firestore-stores.ts';
    const app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }));
    try {
      const response = await app.inject('/healthz');
      if (response.statusCode !== 200 || response.json().protocol !== 'fp.v1') process.exitCode = 1;
    } finally { await app.close(); }
  `], { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 20_000,
    env: { PATH: process.env.PATH } });
  expect(result.error).toBeUndefined();
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
}, 25_000);
