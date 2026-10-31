import { SignJWT } from 'jose';
import { expect, test } from 'vitest';
import { verifySessionToken } from '../src/auth/tokens.ts';

const secret = new TextEncoder().encode('synthetic-session-secret-32-bytes-long');
const now = 1_800_000_000;
const valid = { sub: 'synthetic-user', kid: 'synthetic-key', tier: 'hardware', iat: now, exp: now + 900,
  iss: 'fingerpost-gateway', aud: 'fp.v1' };
const sign = (claims: Record<string, unknown>) => new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).sign(secret);

test.each(['iat', 'exp'])('session tokens require the %s lifetime claim', async (claim) => {
  const claims: Record<string, unknown> = { ...valid }; delete claims[claim];
  expect(await verifySessionToken(secret, await sign(claims), now * 1000)).toBeNull();
});

test.each([{ sub: '' }, { kid: '' }, { iat: now + 1 }, { exp: now + 901 }, { exp: now - 1 }])(
  'signed tokens with invalid identity or lifetime are refused: %j', async (overrides) => {
    expect(await verifySessionToken(secret, await sign({ ...valid, ...overrides }), now * 1000)).toBeNull();
  });

test('the specified 900-second token remains accepted up to its expiry', async () => {
  const token = await sign(valid);
  expect(await verifySessionToken(secret, token, (now + 899) * 1000)).toEqual({ uid: valid.sub, keyId: valid.kid, tier: 'hardware' });
  expect(await verifySessionToken(secret, token, (now + 900) * 1000)).toBeNull();
});
