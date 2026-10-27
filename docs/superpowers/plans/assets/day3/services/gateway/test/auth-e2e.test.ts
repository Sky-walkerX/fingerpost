import { afterEach, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { encodeFrame } from '@fingerpost/protocol';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { issueSessionToken } from '../src/auth/tokens.ts';
import { MemoryFlagStore, MemoryQuotaStore } from '../src/quota/ports.ts';

const SECRET = 'k'.repeat(32);
const cfg = (over: Record<string, string> = {}) => loadConfig({ LOG_LEVEL: 'silent', AUTH_REQUIRED: 'true', SESSION_SECRET: SECRET, SIGNING_DIGESTS: 'ab'.repeat(32), ...over });
const hello = { type: 'hello', id: 'c1', ts: 1, appVersion: '0.1.0', protocol: 'fp.v1', locale: 'en', mode: 'auto', privacy: 'normal', caps: {} };
const goal = { type: 'goal', id: 'g1', ts: 2, text: 'start', source: 'typed' };
const kf = (id: string) => encodeFrame({ type: 'keyframe', id, ts: 3, kind: 'screen', imageSize: { w: 1000, h: 500 }, ocrTokens: [], purpose: 'locate' }, new Uint8Array([0xff, 0xd8]));
const policy = { trustedRoots: [], packageName: 'io.github.fingerpost', signatureDigests: [], allowSoftware: true };

let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

async function open(token?: string, stores = { quotaStore: new MemoryQuotaStore(), flagStore: new MemoryFlagStore() }, over: Record<string, string> = {}) {
  app = await buildApp(cfg(over), { ...stores, auth: { policy } });
  await app.ready();
  const ws = await app.injectWS('/v1/session', token ? { headers: { authorization: `Bearer ${token}` } } : {});
  const msgs: any[] = [];
  ws.on('message', (d: Buffer) => msgs.push(JSON.parse(d.toString())));
  const closed = new Promise<number>((r) => ws.on('close', (code: number) => r(code)));
  const until = async (pred: (m: any) => boolean) => { for (let i = 0; i < 200; i++) { const m = msgs.find(pred); if (m) return m; await new Promise((r) => setTimeout(r, 5)); } throw new Error('timeout'); };
  return { ws, msgs, closed, until };
}

test('live-style config without a session token closes the socket with 4401', async () => {
  const { closed } = await open();
  expect(await closed).toBe(4401);
});

test('a valid token opens the session; quota counts tasks per goal, not per keyframe', async () => {
  const token = await issueSessionToken(new TextEncoder().encode(SECRET), { uid: 'u1', keyId: 'k', tier: 'software' });
  const quotaStore = new MemoryQuotaStore();
  const { ws, until } = await open(token, { quotaStore, flagStore: new MemoryFlagStore() });
  ws.send(JSON.stringify(hello)); await until((m) => m.type === 'ready');
  ws.send(JSON.stringify(goal)); ws.send(kf('k1')); await until((m) => m.type === 'target');
  ws.send(kf('k2')); await new Promise((r) => setTimeout(r, 30));
  expect([...quotaStore.tasks.values()]).toEqual([1]);
  expect([...quotaStore.spend.values()][0]).toBeGreaterThan(0); // SAM images counted
  ws.terminate();
});

test('when the user is out of tasks, the locate keyframe gets quota_exhausted instead of a target', async () => {
  const token = await issueSessionToken(new TextEncoder().encode(SECRET), { uid: 'u2', keyId: 'k', tier: 'software' });
  const quotaStore = new MemoryQuotaStore();
  const day = new Date().toISOString().slice(0, 10);
  quotaStore.tasks.set(`${day}/u2`, 10); // software tier limit is 10
  const { ws, until, msgs } = await open(token, { quotaStore, flagStore: new MemoryFlagStore() });
  ws.send(JSON.stringify(hello)); await until((m) => m.type === 'ready');
  ws.send(JSON.stringify(goal)); ws.send(kf('k1'));
  expect(await until((m) => m.type === 'error')).toMatchObject({ code: 'quota_exhausted', retryable: false });
  expect(msgs.some((m) => m.type === 'target')).toBe(false);
  ws.terminate();
});

test('with the kill switch off, tasks get cloud_paused', async () => {
  const token = await issueSessionToken(new TextEncoder().encode(SECRET), { uid: 'u3', keyId: 'k', tier: 'hardware' });
  const { ws, until } = await open(token, { quotaStore: new MemoryQuotaStore(), flagStore: new MemoryFlagStore(false) });
  ws.send(JSON.stringify(hello)); await until((m) => m.type === 'ready');
  ws.send(JSON.stringify(goal)); ws.send(kf('k1'));
  expect(await until((m) => m.type === 'error')).toMatchObject({ code: 'cloud_paused' });
  ws.terminate();
});

test('config: AUTH_REQUIRED defaults to true in live mode and then needs a secret and digests', () => {
  expect(() => loadConfig({ MODEL_MODE: 'live', META_API_KEY: 'x' })).toThrow(/SESSION_SECRET.*SIGNING_DIGESTS|SIGNING_DIGESTS.*SESSION_SECRET/s);
  expect(loadConfig({}).AUTH_REQUIRED).toBe(false);
});
