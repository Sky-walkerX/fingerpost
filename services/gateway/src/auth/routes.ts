import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyAttestation, type AttestationPolicy } from './attestation.ts';
import type { ChallengeStore } from './challenges.ts';
import { issueSessionToken, TOKEN_TTL_S } from './tokens.ts';
import { clientKey, FixedWindowLimiter, overflowKey } from './rate-limit.ts';

export interface AuthDeps {
  challenges: ChallengeStore;
  /** Firebase Auth: anonymous ID token → uid, or null. Live: firebase-admin getAuth().verifyIdToken. */
  verifyFirebaseIdToken: (idToken: string) => Promise<string | null>;
  policy: AttestationPolicy;
  secret: Uint8Array;
  now?: () => number;
  /** Per client IP per hour. Defaults: 60 challenges, 20 attests. */
  limits?: { challengesPerHour?: number; attestsPerHour?: number };
}

const AttestBody = z.object({
  challengeId: z.string().min(1).max(64),
  /** Base64 DER certificates, leaf first (Android KeyStore.getCertificateChain order). */
  chain: z.array(z.string().min(1).max(16_384)).min(2).max(10),
  firebaseIdToken: z.string().min(1).max(4096),
});

export function registerAuthRoutes(app: FastifyInstance, d: AuthDeps): void {
  const now = d.now ?? Date.now;
  const hour = 60 * 60_000;
  const challengeLimit = new FixedWindowLimiter(d.limits?.challengesPerHour ?? 60, hour, now);
  const attestLimit = new FixedWindowLimiter(d.limits?.attestsPerHour ?? 20, hour, now);

  app.post('/v1/auth/challenge', async (req, reply) => {
    const client = clientKey(req.ip);
    if (!challengeLimit.hit(client, overflowKey(req.ip))) return reply.code(429).send({ error: 'rate limited' });
    const issued = d.challenges.issue(client);
    if (!issued) return reply.code(503).send({ error: 'busy' });
    return { challengeId: issued.challengeId, nonce: Buffer.from(issued.nonce).toString('base64url') };
  });

  app.post('/v1/auth/attest', async (req, reply) => {
    if (!attestLimit.hit(clientKey(req.ip), overflowKey(req.ip))) return reply.code(429).send({ error: 'rate limited' });
    const body = AttestBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid body' });
    const nonce = d.challenges.take(body.data.challengeId);
    if (!nonce) return reply.code(401).send({ error: 'unknown or used challenge' });
    const uid = await d.verifyFirebaseIdToken(body.data.firebaseIdToken);
    if (!uid) return reply.code(401).send({ error: 'invalid firebase token' });
    const chain = body.data.chain.map((c) => new Uint8Array(Buffer.from(c, 'base64')));
    const result = verifyAttestation(chain, nonce, { ...d.policy, now: new Date(now()) });
    if (!result.ok) {
      req.log.warn({ reason: result.reason }, 'attestation rejected');
      return reply.code(403).send({ error: 'attestation rejected' });
    }
    const tier = result.level === 'software' ? 'software' : 'hardware';
    const token = await issueSessionToken(d.secret, { uid, keyId: result.keyId, tier }, now());
    return { token, expiresIn: TOKEN_TTL_S, tier };
  });
}
