import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { MemoryWaitlistStore, type WaitlistEntry } from '../src/waitlist/store.ts';
import { FirestoreWaitlistStore } from '../src/waitlist/firestore-store.ts';
import { MemoryMinVersionSource } from '../src/min-version/source.ts';
import { RemoteConfigMinVersionSource } from '../src/min-version/remote-config-source.ts';
import { MemoryFlagStore } from '../src/quota/ports.ts';

const T0 = Date.UTC(2026, 10, 2, 12, 0, 0);

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('waitlist and config endpoints (B6-2)', () => {
  test('honeypot rejects', async () => {
    const waitlistStore = new MemoryWaitlistStore();
    let nowMs = T0;
    const cfg = loadConfig({ ...process.env, MODEL_MODE: 'mock' });
    app = await buildApp(cfg, { waitlistStore, now: () => nowMs });

    const r = await app.inject({
      method: 'POST',
      url: '/v1/waitlist',
      payload: {
        email: 'user@example.com',
        locale: 'en',
        website: 'https://spam-bot.example.com',
      },
    });

    expect(r.statusCode).toBe(400);
    expect(waitlistStore.entries).toHaveLength(0);
  });

  test('rate limit 429', async () => {
    const waitlistStore = new MemoryWaitlistStore();
    let nowMs = T0;
    const cfg = loadConfig({ ...process.env, MODEL_MODE: 'mock' });
    app = await buildApp(cfg, { waitlistStore, now: () => nowMs });

    const clientHeaders = { 'x-forwarded-for': '198.51.100.10' };
    const codes: number[] = [];

    for (let i = 0; i < 6; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/v1/waitlist',
        headers: clientHeaders,
        payload: {
          email: `user${i}@example.com`,
          locale: 'en',
          website: '',
        },
      });
      codes.push(r.statusCode);
    }

    expect(codes).toEqual([200, 200, 200, 200, 200, 429]);
  });

  test('config cached (the source is read once within 30 s and again after)', async () => {
    let nowMs = T0;
    const minVersionSource = new MemoryMinVersionSource('0.1.0');
    const cfg = loadConfig({ ...process.env, MODEL_MODE: 'mock' });
    app = await buildApp(cfg, { minVersionSource, now: () => nowMs });

    // First call at t = 0: source is read
    const r1 = await app.inject({ method: 'GET', url: '/v1/config' });
    expect(r1.statusCode).toBe(200);
    expect(r1.json()).toEqual({ minVersion: '0.1.0', cloudEnabled: true });
    expect(minVersionSource.reads).toBe(1);

    // Second call at t = 10s (< 30s): served from cache, source is not read again
    nowMs += 10_000;
    const r2 = await app.inject({ method: 'GET', url: '/v1/config' });
    expect(r2.statusCode).toBe(200);
    expect(r2.json()).toEqual({ minVersion: '0.1.0', cloudEnabled: true });
    expect(minVersionSource.reads).toBe(1);

    // Third call after 30s (t = 31s): cache expired, source is read again
    nowMs += 21_000; // total 31s
    const r3 = await app.inject({ method: 'GET', url: '/v1/config' });
    expect(r3.statusCode).toBe(200);
    expect(r3.json()).toEqual({ minVersion: '0.1.0', cloudEnabled: true });
    expect(minVersionSource.reads).toBe(2);
  });

  test('bad email → 400', async () => {
    const waitlistStore = new MemoryWaitlistStore();
    let nowMs = T0;
    const cfg = loadConfig({ ...process.env, MODEL_MODE: 'mock' });
    app = await buildApp(cfg, { waitlistStore, now: () => nowMs });

    const badPayloads = [
      { email: 'not-an-email', locale: 'en' },
      { email: '', locale: 'en' },
      { email: 'user@', locale: 'hi' },
      { email: 'user@domain', locale: 'es' },
      { email: 123, locale: 'en' },
      { locale: 'en' },
      { email: 'user@example.com', locale: 'invalid-locale' },
    ];

    for (const payload of badPayloads) {
      const r = await app.inject({
        method: 'POST',
        url: '/v1/waitlist',
        payload,
      });
      expect(r.statusCode).toBe(400);
    }

    expect(waitlistStore.entries).toHaveLength(0);
  });

  test('duplicate email stored once', async () => {
    const waitlistStore = new MemoryWaitlistStore();
    let nowMs = T0;
    const cfg = loadConfig({ ...process.env, MODEL_MODE: 'mock' });
    app = await buildApp(cfg, { waitlistStore, now: () => nowMs });

    const r1 = await app.inject({
      method: 'POST',
      url: '/v1/waitlist',
      payload: { email: 'user@example.com', locale: 'en' },
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json()).toEqual({ ok: true });

    // Repeated email with different casing/whitespace and another locale returns same 200
    const r2 = await app.inject({
      method: 'POST',
      url: '/v1/waitlist',
      payload: { email: '  USER@EXAMPLE.COM  ', locale: 'hi' },
    });
    expect(r2.statusCode).toBe(200);
    expect(r2.json()).toEqual({ ok: true });

    expect(waitlistStore.entries).toHaveLength(1);
    expect(waitlistStore.entries[0]).toEqual({
      email: 'user@example.com',
      locale: 'en',
      createdAt: T0,
    });
  });

  test('kill switch off → cloudEnabled false', async () => {
    const flagStore = new MemoryFlagStore(false, 'daily budget cap reached');
    const cfg = loadConfig({ ...process.env, MODEL_MODE: 'mock' });
    app = await buildApp(cfg, { flagStore, now: () => T0 });

    const r = await app.inject({ method: 'GET', url: '/v1/config' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ minVersion: '0.1.0', cloudEnabled: false });
  });

  test('RemoteConfigMinVersionSource reads parameter and keeps last good value on error', async () => {
    let shouldFail = false;
    let version = '0.2.0';
    const fakeRemoteConfig = {
      getTemplate: async () => {
        if (shouldFail) throw new Error('Remote Config network timeout');
        return {
          parameters: {
            min_supported_version: {
              defaultValue: { value: version },
            },
          },
        };
      },
    };

    const source = new RemoteConfigMinVersionSource(fakeRemoteConfig as any, '0.1.0');

    // First fetch succeeds
    const v1 = await source.getMinVersion();
    expect(v1).toBe('0.2.0');

    // Fetch fails: keeps last good value
    shouldFail = true;
    const v2 = await source.getMinVersion();
    expect(v2).toBe('0.2.0');

    // If initial fetch fails, keeps initial default
    const failingInitSource = new RemoteConfigMinVersionSource(fakeRemoteConfig as any, '0.1.0');
    const vInitFail = await failingInitSource.getMinVersion();
    expect(vInitFail).toBe('0.1.0');
  });

  test('FirestoreWaitlistStore writes waitlist/{id} with exact fields and deduplicates', async () => {
    const docs = new Map<string, Record<string, unknown>>();
    const fakeDb = {
      collection: (name: string) => {
        expect(name).toBe('waitlist');
        return {
          doc: (id: string) => ({
            get: async () => ({
              exists: docs.has(id),
              data: () => docs.get(id),
            }),
            set: async (data: Record<string, unknown>) => {
              docs.set(id, data);
            },
          }),
        };
      },
    };

    const store = new FirestoreWaitlistStore(fakeDb as any);
    const entry: WaitlistEntry = {
      email: 'test@example.com',
      locale: 'es',
      createdAt: T0,
    };

    const saved1 = await store.add(entry);
    expect(saved1).toBe(true);
    expect(docs.size).toBe(1);

    const [docId, storedData] = [...docs.entries()][0]!;
    expect(docId).toBeDefined();
    expect(docId).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
    // Must contain { email, locale, createdAt } and nothing else
    expect(storedData).toEqual({
      email: 'test@example.com',
      locale: 'es',
      createdAt: T0,
    });
    expect(Object.keys(storedData).sort()).toEqual(['createdAt', 'email', 'locale']);

    // Storing duplicate email does not write twice
    const saved2 = await store.add({
      email: 'test@example.com',
      locale: 'en',
      createdAt: T0 + 10_000,
    });
    expect(saved2).toBe(false);
    expect(docs.size).toBe(1);
    expect(docs.get(docId)?.createdAt).toBe(T0);
  });
});

