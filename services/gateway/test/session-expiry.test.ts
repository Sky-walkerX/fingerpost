import { SignJWT } from 'jose';
import { afterEach, expect, test, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { encodeFrame, type ServerMessage } from '@fingerpost/protocol';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { issueSessionToken } from '../src/auth/tokens.ts';
import { mockModels } from '../src/models/mock/mock-models.ts';

const secret = 'synthetic-session-expiry-secret-32-bytes';
const key = new TextEncoder().encode(secret), epoch = Date.UTC(2026, 9, 31);
const apps: FastifyInstance[] = [];
afterEach(async () => { for (const app of apps.splice(0)) await app.close(); });
const hello = { type: 'hello', id: 'h', ts: 1, appVersion: '0.1.0', protocol: 'fp.v1', locale: 'en', mode: 'guide', privacy: 'normal', caps: {} };
const goal = { type: 'goal', id: 'g', ts: 2, text: 'start', source: 'typed' };
const frame = encodeFrame({ type: 'keyframe', id: 'k', ts: 3, kind: 'screen', purpose: 'locate', imageSize: { w: 1000, h: 500 }, ocrTokens: [] }, new Uint8Array([0xff, 0xd8]));
async function open(clock: () => number, models = mockModels(), customToken?: string) {
  const app = await buildApp(loadConfig({ LOG_LEVEL: 'silent', AUTH_REQUIRED: 'true', SESSION_SECRET: secret, SIGNING_DIGESTS: 'ab'.repeat(32) }),
    { now: clock, models, auth: { policy: { trustedRoots: [], packageName: 'io.github.fingerpost', signatureDigests: [], allowSoftware: true } } });
  apps.push(app); await app.ready();
  const token = customToken ?? await issueSessionToken(key, { uid: 'synthetic-user', keyId: 'synthetic-key', tier: 'hardware' }, epoch);
  const ws = await app.injectWS('/v1/session', { headers: { authorization: `Bearer ${token}` } });
  let closeCode: number | undefined;
  ws.on('close', code => { closeCode = code; });
  const messages: ServerMessage[] = [];
  ws.on('message', data => messages.push(JSON.parse(data.toString()) as ServerMessage));
  ws.send(JSON.stringify(hello));
  await vi.waitFor(() => expect(messages.some(m => m.type === 'ready')).toBe(true));
  return { ws, messages, closed: () => closeCode };
}

test('a connected session rejects new work at the JWT expiry boundary', async () => {
  let now = epoch;
  const models = mockModels(); models.parseScreen = vi.fn(models.parseScreen);
  const c = await open(() => now, models);
  try {
    now += 900_000;
    c.ws.send(JSON.stringify(goal)); c.ws.send(frame);
    await vi.waitFor(() => expect(c.closed()).toBe(4401));
    expect(models.parseScreen).not.toHaveBeenCalled();
    expect(c.messages.some(m => m.type === 'target')).toBe(false);
  } finally { c.ws.terminate(); }
});

test('a model result arriving after expiry cannot emit a layout or target', async () => {
  let now = epoch, release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const models = mockModels(), parse = models.parseScreen;
  models.parseScreen = vi.fn(async (...args: Parameters<typeof parse>) => { await pending; return parse(...args); });
  const c = await open(() => now, models);
  try {
    c.ws.send(JSON.stringify(goal)); c.ws.send(frame);
    await vi.waitFor(() => expect(models.parseScreen).toHaveBeenCalledOnce());
    now += 900_000; release();
    await vi.waitFor(() => expect(c.closed()).toBe(4401));
    expect(c.messages.some(m => m.type === 'layout' || m.type === 'target')).toBe(false);
  } finally { release(); c.ws.terminate(); }
});

test('an idle authenticated socket closes at the signed deadline without another message', async () => {
  const token = await new SignJWT({ kid: 'synthetic-key', tier: 'hardware' }).setProtectedHeader({ alg: 'HS256' })
    .setSubject('synthetic-user').setIssuer('fingerpost-gateway').setAudience('fp.v1')
    .setIssuedAt(epoch / 1000).setExpirationTime(epoch / 1000 + 1).sign(key);
  const c = await open(() => epoch + 750, mockModels(), token);
  try { await vi.waitFor(() => expect(c.closed()).toBe(4401)); }
  finally { c.ws.terminate(); }
});
