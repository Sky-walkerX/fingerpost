import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FirestoreFlagStore, FirestoreQuotaStore } from '../src/quota/firestore-stores.ts';
import { DEFAULT_QUOTA, QuotaService } from '../src/quota/service.ts';

export function emulatorProject(env: Record<string, string | undefined>): string {
  if (env.GCLOUD_PROJECT !== 'demo-fingerpost' || env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085')
    throw new Error('Local demo Firestore emulator required');
  return env.GCLOUD_PROJECT;
}

export async function checkFirestore() {
  const projectId = emulatorProject(process.env);
  // The SDK supplies its emulator admin header. Do not probe a cloud metadata server on this laptop.
  process.env.METADATA_SERVER_DETECTION = 'none';
  const app = initializeApp({ projectId }, 'fingerpost-local-check');
  const db = getFirestore(app);
  try {
    const flags = new FirestoreFlagStore(db), store = new FirestoreQuotaStore(db);
    const runtime = db.collection('config').doc('runtime');
    // A fresh demo emulator has no runtime configuration; it must not silently enable spending.
    assert.equal(await flags.getCloudEnabled(), false);
    for (const value of [null, 'false', 1]) {
      await runtime.set({ cloudEnabled: value });
      assert.equal(await flags.getCloudEnabled(), false);
    }
    await flags.setCloudEnabled(true, 'synthetic local check');
    assert.equal(await flags.getCloudEnabled(), true);
    const day = '2026-10-31';
    const values = await Promise.all(Array.from({ length: 4 }, () => store.incrementTasks('synthetic-user', day)));
    assert.deepEqual(values.sort((a, b) => a - b), [1, 2, 3, 4]);
    assert.equal(await store.incrementTasks('synthetic-user', '2026-11-01'), 1);
    const quota = new QuotaService(store, flags, { ...DEFAULT_QUOTA, dailyCapMicros: 5_000,
      tasksPerDay: { hardware: 2, software: 1 } }, () => Date.UTC(2026, 9, 31));
    assert.deepEqual(await quota.startTask('synthetic-quota-user', 'hardware'), { ok: true, tasksLeft: 1 });
    assert.deepEqual(await quota.startTask('synthetic-quota-user', 'hardware'), { ok: true, tasksLeft: 0 });
    assert.deepEqual(await quota.startTask('synthetic-quota-user', 'hardware'), { ok: false, code: 'quota_exhausted' });
    assert.equal(await quota.recordUsage({ kind: 'sam_image', images: 1 }), 2_500);
    assert.equal(await quota.recordUsage({ kind: 'sam_image', images: 1 }), 5_000);
    assert.equal(await flags.getCloudEnabled(), false);
    assert.deepEqual(await quota.startTask('synthetic-other-user', 'hardware'), { ok: false, code: 'cloud_paused' });
    const clientRead = await fetch(`http://127.0.0.1:8085/v1/projects/${projectId}/databases/(default)/documents/config/runtime`);
    assert.equal(clientRead.status, 403);
    await flags.setCloudEnabled(true, 'synthetic failure check');
    const failingQuota = new QuotaService({ incrementTasks: (uid, date) => store.incrementTasks(uid, date),
      addSpend: async () => { throw new Error('synthetic storage failure'); } }, flags);
    await assert.rejects(failingQuota.recordUsage({ kind: 'sam_image', images: 1 }));
    assert.equal(await flags.getCloudEnabled(), false);
    assert.deepEqual(await failingQuota.startTask('synthetic-failure-user', 'hardware'), { ok: false, code: 'cloud_paused' });
    console.log(JSON.stringify({ emulatorOnly: true, checks: 7, passed: 7, transactions: true,
      utcReset: true, quota: true, spendKillSwitch: true, clientRulesDenied: true, accountingFailurePaused: true, cloudCalls: 0 }));
  } finally { await deleteApp(app); }
}

if (import.meta.main) {
  try { await checkFirestore(); }
  catch (error) {
    const code = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
    console.error(JSON.stringify({ emulatorOnly: true, result: 'failed',
      category: error instanceof assert.AssertionError ? 'assertion' : 'sdk_or_configuration',
      ...(code && /^(?:firestore\/)?[a-z_-]{1,40}$/.test(code) ? { code } : {}) }));
    process.exitCode = 1;
  }
}
