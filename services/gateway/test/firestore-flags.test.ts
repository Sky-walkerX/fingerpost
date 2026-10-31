import type { Firestore } from 'firebase-admin/firestore';
import { expect, test } from 'vitest';
import { FirestoreFlagStore } from '../src/quota/firestore-stores.ts';
import { MemoryQuotaStore } from '../src/quota/ports.ts';
import { QuotaService } from '../src/quota/service.ts';

const flagsWith = (value: unknown) => new FirestoreFlagStore({ collection: () => ({ doc: () => ({
  get: async () => ({ get: () => value }),
}) }) } as unknown as Firestore);

test.each([undefined, null, 'false', 1, false])('missing/malformed runtime flag cannot spend a task: %j', async (value) => {
  const store = new MemoryQuotaStore();
  const quota = new QuotaService(store, flagsWith(value));
  expect(await quota.startTask('synthetic-user', 'hardware')).toEqual({ ok: false, code: 'cloud_paused' });
  expect(store.tasks.size).toBe(0);
});

test('explicit boolean true permits the configured daily quota', async () => {
  const quota = new QuotaService(new MemoryQuotaStore(), flagsWith(true));
  expect(await quota.startTask('synthetic-user', 'hardware')).toEqual({ ok: true, tasksLeft: 29 });
});
