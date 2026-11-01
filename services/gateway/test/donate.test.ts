import Fastify from 'fastify';
import { afterEach, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { issueSessionToken } from '../src/auth/tokens.ts';
import { DONATE_CONSENT_VERSION, DONATION_RETENTION_MS, MemoryDonationStore, registerDonateRoute, UPLOAD_URL_TTL_MS,
  type DonateDeps } from '../src/donate/donation.ts';
import { GcsDonationStore } from '../src/donate/gcs-store.ts';

const T0 = Date.UTC(2026, 10, 2, 6, 0, 0);
const secret = new TextEncoder().encode('s'.repeat(32));
const body = (over: Record<string, unknown> = {}) => ({
  consent: { version: DONATE_CONSENT_VERSION, accepted: true },
  redacted: { faces: true, cardNumbers: true },
  locale: 'hi', outcome: 'wrong',
  files: [{ kind: 'keyframe', contentType: 'image/jpeg', bytes: 120_000 }, { kind: 'keyframe', contentType: 'image/jpeg', bytes: 90_000 },
    { kind: 'replay', contentType: 'application/json', bytes: 4_000 }],
  ...over,
});

let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });
async function setup(over: Partial<DonateDeps> = {}) {
  const store = new MemoryDonationStore();
  app = Fastify();
  registerDonateRoute(app, { store, authSecret: null, cloudEnabled: async () => true, now: () => T0, ...over });
  await app.ready();
  const post = (payload: unknown, headers: Record<string, string> = {}) => app!.inject({ method: 'POST', url: '/v1/donate', payload: payload as object, headers });
  return { store, post };
}

test('opted-in, redacted donation gets one signed PUT per file and a 90-day pointer record without uid or IP', async () => {
  const { store, post } = await setup();
  const r = await post(body());
  expect(r.statusCode).toBe(200);
  const res = r.json() as { donationId: string; uploads: { index: number; kind: string; method: string; url: string; headers: Record<string, string> }[]; uploadExpiresAt: number; deleteAfter: number };
  expect(res.uploads.map((u) => [u.index, u.kind, u.method])).toEqual([[0, 'keyframe', 'PUT'], [1, 'keyframe', 'PUT'], [2, 'replay', 'PUT']]);
  expect(res.uploads[0]!.headers).toEqual({ 'content-type': 'image/jpeg', 'x-goog-content-length-range': '1,120000' });
  expect(res.uploadExpiresAt).toBe(T0 + UPLOAD_URL_TTL_MS);
  expect(res.deleteAfter).toBe(T0 + DONATION_RETENTION_MS);
  expect(DONATION_RETENTION_MS).toBe(90 * 24 * 60 * 60_000);
  expect(store.signed.map((s) => s.objectName)).toEqual([
    `2026-11-02/${res.donationId}/0-keyframe.jpg`, `2026-11-02/${res.donationId}/1-keyframe.jpg`, `2026-11-02/${res.donationId}/2-replay.json`]);
  expect(store.records).toHaveLength(1);
  const record = store.records[0]!;
  expect(record).toMatchObject({ id: res.donationId, createdAt: T0, deleteAfter: T0 + DONATION_RETENTION_MS,
    consentVersion: DONATE_CONSENT_VERSION, locale: 'hi', outcome: 'wrong' });
  expect(Object.keys(record).sort()).toEqual(['consentVersion', 'createdAt', 'deleteAfter', 'id', 'locale', 'objects', 'outcome']);
  expect(JSON.stringify(record)).not.toMatch(/127\.0\.0\.1|uid/);
});

test.each([
  ['no consent', { consent: undefined }],
  ['consent declined', { consent: { version: DONATE_CONSENT_VERSION, accepted: false } }],
  ['old consent text', { consent: { version: 'donate.v0', accepted: true } }],
  ['faces not blurred', { redacted: { faces: false, cardNumbers: true } }],
  ['card numbers not masked', { redacted: { faces: true, cardNumbers: false } }],
  ['no files', { files: [] }],
  ['too many keyframes', { files: Array.from({ length: 21 }, () => ({ kind: 'keyframe', contentType: 'image/jpeg', bytes: 10 })) }],
  ['keyframe too large', { files: [{ kind: 'keyframe', contentType: 'image/jpeg', bytes: 409_601 }] }],
  ['keyframe not a jpeg', { files: [{ kind: 'keyframe', contentType: 'image/png', bytes: 10 }] }],
  ['two replays', { files: [{ kind: 'replay', contentType: 'application/json', bytes: 10 }, { kind: 'replay', contentType: 'application/json', bytes: 10 }] }],
  ['audio is never accepted', { files: [{ kind: 'audio', contentType: 'audio/wav', bytes: 10 }] }],
  ['unknown field', { transcript: 'synthetic' }],
])('%s → 400 and nothing is signed or recorded', async (_name, over) => {
  const { store, post } = await setup();
  const r = await post(body(over));
  expect(r.statusCode).toBe(400);
  expect(r.body).not.toContain('synthetic');
  expect(store.signed).toHaveLength(0);
  expect(store.records).toHaveLength(0);
});

test('auth on: a missing or bad session token → 401; a valid one → 200', async () => {
  const { store, post } = await setup({ authSecret: secret });
  expect((await post(body())).statusCode).toBe(401);
  expect((await post(body(), { authorization: 'Bearer nope' })).statusCode).toBe(401);
  const token = await issueSessionToken(secret, { uid: 'uid-1', keyId: 'k1', tier: 'hardware' }, T0);
  expect((await post(body(), { authorization: `Bearer ${token}` })).statusCode).toBe(200);
  expect(JSON.stringify(store.records)).not.toContain('uid-1');
});

test('three donations per user per hour, then 429', async () => {
  let now = T0;
  const { post } = await setup({ authSecret: secret, now: () => now });
  const token = await issueSessionToken(secret, { uid: 'uid-1', keyId: 'k1', tier: 'hardware' }, T0);
  const codes = [];
  for (let i = 0; i < 4; i++) codes.push((await post(body(), { authorization: `Bearer ${token}` })).statusCode);
  expect(codes).toEqual([200, 200, 200, 429]);
  const other = await issueSessionToken(secret, { uid: 'uid-2', keyId: 'k2', tier: 'hardware' }, T0);
  expect((await post(body(), { authorization: `Bearer ${other}` })).statusCode).toBe(200);
  now += 60 * 60_000;
  const fresh = await issueSessionToken(secret, { uid: 'uid-1', keyId: 'k1', tier: 'hardware' }, now);
  expect((await post(body(), { authorization: `Bearer ${fresh}` })).statusCode).toBe(200);
});

test('kill switch on, or no bucket configured → 503 and nothing is signed', async () => {
  const paused = await setup({ cloudEnabled: async () => false });
  expect((await paused.post(body())).statusCode).toBe(503);
  expect(paused.store.signed).toHaveLength(0);
  await app!.close();
  const none = await setup({ store: null });
  const r = await none.post(body());
  expect(r.statusCode).toBe(503);
  expect(r.json()).toEqual({ error: 'donations_unavailable' });
});

test('the pointer is recorded before any URL is signed; a record failure returns 503 with no URLs', async () => {
  const store = new MemoryDonationStore();
  const order: string[] = [];
  store.record = async () => { order.push('record'); throw new Error('synthetic firestore failure'); };
  const sign = store.signUpload.bind(store);
  store.signUpload = async (...a) => { order.push('sign'); return sign(...a); };
  const { post } = await setup({ store });
  const r = await post(body());
  expect(r.statusCode).toBe(503);
  expect(r.body).not.toMatch(/synthetic|https?:/);
  expect(order).toEqual(['record']);
});

test('mock gateway serves the route with an in-memory store; live without DONATE_BUCKET answers 503', async () => {
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }));
  const ok = await app.inject({ method: 'POST', url: '/v1/donate', payload: body() });
  expect(ok.statusCode).toBe(200);
  expect((ok.json() as { uploads: { url: string }[] }).uploads[0]!.url).toMatch(/^https:\/\/donations\.invalid\//);
  await app.close();
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent', MODEL_MODE: 'live', META_API_KEY: 'k', SESSION_SECRET: 's'.repeat(32), SIGNING_DIGESTS: 'ab'.repeat(32) }));
  const token = await issueSessionToken(secret, { uid: 'uid-1', keyId: 'k1', tier: 'hardware' });
  const r = await app.inject({ method: 'POST', url: '/v1/donate', payload: body(), headers: { authorization: `Bearer ${token}` } });
  expect(r.statusCode).toBe(503);
});

test('GCS store signs a v4 write URL bound to the type and size, and writes a TTL pointer to donations/{id}', async () => {
  const signCalls: { name: string; cfg: Record<string, unknown> }[] = [], writes: { path: string; data: Record<string, unknown> }[] = [];
  const bucket = { file: (name: string) => ({ getSignedUrl: async (cfg: Record<string, unknown>) => { signCalls.push({ name, cfg }); return [`https://storage.example/${name}`] as [string]; } }) };
  const db = { collection: (c: string) => ({ doc: (id: string) => ({ set: async (data: Record<string, unknown>) => { writes.push({ path: `${c}/${id}`, data }); } }) }) };
  const gcs = new GcsDonationStore(bucket, db);
  const signed = await gcs.signUpload('2026-11-02/d1/0-keyframe.jpg', 'image/jpeg', 1000, T0 + UPLOAD_URL_TTL_MS);
  expect(signed).toEqual({ url: 'https://storage.example/2026-11-02/d1/0-keyframe.jpg', headers: { 'content-type': 'image/jpeg', 'x-goog-content-length-range': '1,1000' } });
  expect(signCalls[0]!.cfg).toEqual({ version: 'v4', action: 'write', expires: T0 + UPLOAD_URL_TTL_MS, contentType: 'image/jpeg',
    extensionHeaders: { 'x-goog-content-length-range': '1,1000' } });
  await gcs.record({ id: 'd1', createdAt: T0, deleteAfter: T0 + DONATION_RETENTION_MS, consentVersion: DONATE_CONSENT_VERSION, locale: 'en', outcome: 'failed',
    objects: [{ name: '2026-11-02/d1/0-keyframe.jpg', kind: 'keyframe', contentType: 'image/jpeg', bytes: 1000 }] });
  expect(writes[0]!.path).toBe('donations/d1');
  expect(writes[0]!.data.expireAt).toEqual(new Date(T0 + DONATION_RETENTION_MS));
});
