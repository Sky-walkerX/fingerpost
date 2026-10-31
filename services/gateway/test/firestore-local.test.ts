import { expect, test } from 'vitest';
import { emulatorProject } from '../scripts/firestore-local.ts';

test('local Firestore checks require both the demo project and the explicit loopback emulator', () => {
  expect(emulatorProject({ GCLOUD_PROJECT: 'demo-fingerpost', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085' })).toBe('demo-fingerpost');
});

test.each([
  {}, { GCLOUD_PROJECT: 'demo-fingerpost' },
  { GCLOUD_PROJECT: 'synthetic-real-project', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085' },
  { GCLOUD_PROJECT: 'demo-fingerpost', FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:443' },
  { GCLOUD_PROJECT: 'demo-fingerpost', FIRESTORE_EMULATOR_HOST: 'https://127.0.0.1:8085' },
])('local integration refuses cloud/ambiguous configuration before creating a client: %j', (env) => {
  expect(() => emulatorProject(env)).toThrow('Local demo Firestore emulator required');
});
