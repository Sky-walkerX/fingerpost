import { expect, test } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { loadConfig } from '../src/config.ts';
import { FirestoreQuotaStore } from '../src/quota/firestore-stores.ts';

const live = { MODEL_MODE: 'live', META_API_KEY: 'synthetic', SESSION_SECRET: 's'.repeat(32), SIGNING_DIGESTS: 'a'.repeat(64), FIREBASE_PROJECT_ID: 'synthetic-project', MONITORING_ENABLED: 'true', MONITORING_SINGLE_WRITER: 'true' };

test('monitoring is off by default and requires authenticated single-writer live configuration', () => {
  expect(loadConfig({}).MONITORING_ENABLED).toBe(false);
  expect(loadConfig(live).MONITORING_ENABLED).toBe(true);
  for (const patch of [{ MODEL_MODE: 'mock' }, { MONITORING_SINGLE_WRITER: 'false' }, { FIREBASE_PROJECT_ID: undefined }, { FIREBASE_PROJECT_ID: 'invalid/project' }, { AUTH_REQUIRED: 'false', ALLOW_UNAUTHENTICATED_LIVE: 'true' }]) {
    expect(() => loadConfig({ ...live, ...patch })).toThrow('monitoring requires');
  }
});

function store(rows: unknown[]) {
  const db = { collection: (name: string) => {
    expect(name).toBe('spend');
    return { doc: (day: string) => ({ collection: (shards: string) => {
      expect(day).toBe('2026-11-02'); expect(shards).toBe('shards');
      return { get: async () => ({ docs: rows.map((micros) => ({ get: () => micros })) }) };
    } }) };
  } } as unknown as Firestore;
  return new FirestoreQuotaStore(db);
}

test('export reads current authoritative spend without incrementing it; absent day is a true zero', async () => {
  expect(await store([12, 34]).readSpend('2026-11-02')).toBe(46);
  expect(await store([]).readSpend('2026-11-02')).toBe(0);
});

test('malformed or overflowing ledger values stay unknown rather than looking like zero', async () => {
  for (const rows of [[undefined], [-1], ['12'], [NaN], [1.5], [Number.MAX_SAFE_INTEGER, 1]]) {
    await expect(store(rows).readSpend('2026-11-02')).rejects.toThrow('Spend ledger unavailable');
  }
});
