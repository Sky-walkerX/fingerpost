import { randomBytes } from 'node:crypto';
import { ulid } from 'ulid';

/** Single-use attestation challenges, 32 random bytes, valid for 5 minutes. In memory (one instance per region is fine for v1). */
export class ChallengeStore {
  private readonly m = new Map<string, { nonce: Uint8Array; exp: number }>();
  constructor(private readonly now: () => number = Date.now, private readonly ttlMs = 5 * 60_000) {}

  issue(): { challengeId: string; nonce: Uint8Array } {
    throw new Error('TODO(D3-T6): implement this; the tests describe the behaviour');
  }

  /** Returns the nonce once; a second take, or a take after expiry, returns null. */
  take(id: string): Uint8Array | null {
    throw new Error('TODO(D3-T6): implement this; the tests describe the behaviour');
  }

  private sweep() {
    throw new Error('TODO(D3-T6): implement this; the tests describe the behaviour');
  }
}
