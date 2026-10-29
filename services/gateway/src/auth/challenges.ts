import { randomBytes } from 'node:crypto';
import { ulid } from 'ulid';

/** Single-use attestation challenges, 32 random bytes, valid for 5 minutes. In memory (one instance per region is fine for v1). */
export class ChallengeStore {
  private readonly m = new Map<string, { nonce: Uint8Array; exp: number }>();
  constructor(private readonly now: () => number = Date.now, private readonly ttlMs = 5 * 60_000) {}

  issue(): { challengeId: string; nonce: Uint8Array } {
    this.sweep();
    const challengeId = ulid(), nonce = new Uint8Array(randomBytes(32));
    this.m.set(challengeId, { nonce, exp: this.now() + this.ttlMs });
    return { challengeId, nonce };
  }

  /** Returns the nonce once; a second take, or a take after expiry, returns null. */
  take(id: string): Uint8Array | null {
    const entry = this.m.get(id);
    this.m.delete(id);
    return entry && entry.exp >= this.now() ? entry.nonce : null;
  }

  private sweep() {
    const now = this.now();
    for (const [id, entry] of this.m) if (entry.exp < now) this.m.delete(id);
  }
}
