import { jwtVerify, SignJWT } from 'jose';

import type { SessionClaims } from '../session/types.ts';
export type { SessionClaims, Tier } from '../session/types.ts';
export const TOKEN_TTL_S = 15 * 60;
const ISS = 'fingerpost-gateway', AUD = 'fp.v1';

/** HS256 session JWT, 15 minutes, bound to the Firebase anonymous uid and the attested key. */
export async function issueSessionToken(secret: Uint8Array, c: SessionClaims, nowMs = Date.now()): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  return new SignJWT({ kid: c.keyId, tier: c.tier }).setProtectedHeader({ alg: 'HS256' })
    .setSubject(c.uid).setIssuer(ISS).setAudience(AUD).setIssuedAt(iat).setExpirationTime(iat + TOKEN_TTL_S).sign(secret);
}

/** null for anything invalid or expired. */
export async function verifySessionToken(secret: Uint8Array, token: string, nowMs = Date.now()): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISS, audience: AUD, algorithms: ['HS256'], currentDate: new Date(nowMs) });
    const { sub, kid, tier } = payload;
    if (typeof sub !== 'string' || typeof kid !== 'string' || (tier !== 'hardware' && tier !== 'software')) return null;
    return { uid: sub, keyId: kid, tier };
  } catch {
    return null;
  }
}
