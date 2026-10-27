import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyAttestation, type AttestationPolicy } from './attestation.ts';
import type { ChallengeStore } from './challenges.ts';
import { issueSessionToken, TOKEN_TTL_S } from './tokens.ts';

export interface AuthDeps {
  challenges: ChallengeStore;
  /** Firebase Auth: anonymous ID token → uid, or null. Live: firebase-admin getAuth().verifyIdToken. */
  verifyFirebaseIdToken: (idToken: string) => Promise<string | null>;
  policy: AttestationPolicy;
  secret: Uint8Array;
  now?: () => number;
}

const AttestBody = z.object({
  challengeId: z.string().min(1).max(64),
  /** Base64 DER certificates, leaf first (Android KeyStore.getCertificateChain order). */
  chain: z.array(z.string().min(1).max(16_384)).min(2).max(10),
  firebaseIdToken: z.string().min(1).max(4096),
});

export function registerAuthRoutes(app: FastifyInstance, d: AuthDeps): void {
  throw new Error('TODO(D3-T6): implement this; the tests describe the behaviour');
}
