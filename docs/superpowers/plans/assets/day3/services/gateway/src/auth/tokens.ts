import { jwtVerify, SignJWT } from 'jose';

import type { SessionClaims } from '../session/types.ts';
export type { SessionClaims, Tier } from '../session/types.ts';
export const TOKEN_TTL_S = 15 * 60;
const ISS = 'fingerpost-gateway', AUD = 'fp.v1';

/** HS256 session JWT, 15 minutes, bound to the Firebase anonymous uid and the attested key. */
export async function issueSessionToken(secret: Uint8Array, c: SessionClaims, nowMs = Date.now()): Promise<string> {
  throw new Error('TODO(D3-T6): implement this; the tests describe the behaviour');
}

/** null for anything invalid or expired. */
export async function verifySessionToken(secret: Uint8Array, token: string, nowMs = Date.now()): Promise<SessionClaims | null> {
  throw new Error('TODO(D3-T6): implement this; the tests describe the behaviour');
}
