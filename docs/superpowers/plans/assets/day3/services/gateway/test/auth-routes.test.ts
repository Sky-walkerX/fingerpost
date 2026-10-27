import { X509Certificate } from 'node:crypto';
import Fastify from 'fastify';
import { expect, test } from 'vitest';
import { ChallengeStore } from '../src/auth/challenges.ts';
import { registerAuthRoutes } from '../src/auth/routes.ts';
import { verifySessionToken } from '../src/auth/tokens.ts';
import { fakeChain } from './helpers/fake-attestation.ts';

const secret = new TextEncoder().encode('s'.repeat(32));
const digest = 'cd'.repeat(32);

async function setup(rootForPolicy?: Uint8Array) {
  const app = Fastify();
  const challenges = new ChallengeStore();
  let root = rootForPolicy;
  const policy = { get trustedRoots() { return [new X509Certificate(Buffer.from(root!))]; }, packageName: 'io.github.fingerpost', signatureDigests: [digest], allowSoftware: false };
  registerAuthRoutes(app, { challenges, policy, secret, verifyFirebaseIdToken: async (t) => (t === 'good-id-token' ? 'uid-1' : null) });
  const ch = (await app.inject({ method: 'POST', url: '/v1/auth/challenge' })).json() as { challengeId: string; nonce: string };
  const nonce = new Uint8Array(Buffer.from(ch.nonce, 'base64url'));
  const { chain, root: r } = await fakeChain({ challenge: nonce, signatureDigestHex: digest });
  root ??= r;
  const attest = (over: Record<string, unknown> = {}) => app.inject({ method: 'POST', url: '/v1/auth/attest', payload: { challengeId: ch.challengeId, chain: chain.map((c) => Buffer.from(c).toString('base64')), firebaseIdToken: 'good-id-token', ...over } });
  return { app, attest };
}

test('challenge → attest → a verifiable hardware-tier token', async () => {
  const { attest } = await setup();
  const r = await attest();
  expect(r.statusCode).toBe(200);
  const body = r.json() as { token: string; expiresIn: number; tier: string };
  expect(body).toMatchObject({ expiresIn: 900, tier: 'hardware' });
  expect(await verifySessionToken(secret, body.token)).toMatchObject({ uid: 'uid-1', tier: 'hardware' });
});
test('a challenge can be used once', async () => {
  const { attest } = await setup();
  expect((await attest()).statusCode).toBe(200);
  expect((await attest()).statusCode).toBe(401);
});
test('bad firebase token → 401; bad body → 400; untrusted root → 403', async () => {
  expect((await (await setup()).attest({ firebaseIdToken: 'nope' })).statusCode).toBe(401);
  expect((await (await setup()).attest({ chain: [] })).statusCode).toBe(400);
  const other = await fakeChain({ challenge: new Uint8Array(32) });
  expect((await (await setup(other.root)).attest()).statusCode).toBe(403);
});
