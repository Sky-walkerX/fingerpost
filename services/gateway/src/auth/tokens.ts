import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

import type { SessionClaims } from '../session/types.ts';
export type { SessionClaims, Tier } from '../session/types.ts';
export const TOKEN_TTL_S = 15 * 60;
const ISS = 'fingerpost-gateway', AUD = 'fp.v1';
const Claims = z.object({ sub: z.string().min(1), kid: z.string().min(1), tier: z.enum(['hardware', 'software']),
  iat: z.number().int().nonnegative(), exp: z.number().int().nonnegative() })
  .refine((claims) => claims.exp > claims.iat && claims.exp - claims.iat <= TOKEN_TTL_S);

/** HS256 session JWT, 15 minutes, bound to the Firebase anonymous uid and the attested key. */
export async function issueSessionToken(secret: Uint8Array, c: SessionClaims, nowMs = Date.now()): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  return new SignJWT({ kid: c.keyId, tier: c.tier }).setProtectedHeader({ alg: 'HS256' })
    .setSubject(c.uid).setIssuer(ISS).setAudience(AUD).setIssuedAt(iat).setExpirationTime(iat + TOKEN_TTL_S).sign(secret);
}

/** null for anything invalid or expired. */
export async function verifySessionGrant(secret: Uint8Array, token: string, nowMs = Date.now()): Promise<{ claims: SessionClaims; expiresAtMs: number } | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISS, audience: AUD, algorithms: ['HS256'],
      requiredClaims: ['sub', 'kid', 'tier', 'iat', 'exp'], maxTokenAge: TOKEN_TTL_S, currentDate: new Date(nowMs) });
    const claims = Claims.safeParse(payload);
    if (!claims.success) return null;
    const { sub, kid, tier } = claims.data;
    return { claims: { uid: sub, keyId: kid, tier }, expiresAtMs: claims.data.exp * 1000 };
  } catch {
    return null;
  }
}

export async function verifySessionToken(secret: Uint8Array, token: string, nowMs = Date.now()): Promise<SessionClaims | null> {
  return (await verifySessionGrant(secret, token, nowMs))?.claims ?? null;
}
