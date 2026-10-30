import { randomBytes } from 'node:crypto';
import { ulid } from 'ulid';

const MAX_OUTSTANDING = 100_000;
/** Outstanding challenges per client prefix; a new one replaces that client's oldest, never someone else's. */
const PER_CLIENT = 5;

/** Single-use attestation challenges, 32 random bytes, valid for 5 minutes. In memory (one instance per region is fine for v1). */
export class ChallengeStore {
  private readonly m = new Map<string, { nonce: Uint8Array; exp: number; client: string }>();
  private readonly byClient = new Map<string, string[]>();
  private readonly now: () => number;
  private readonly ttlMs: number;
  constructor(now: () => number = Date.now, ttlMs = 5 * 60_000) {
    this.now = now;
    this.ttlMs = ttlMs;
  }

  /**
   * null only when the global table is full (the caller answers 503). With the per-client cap and the per-prefix
   * issuance limit in front, that takes ~20k distinct prefixes within the 5-minute TTL.
   */
  issue(client = ''): { challengeId: string; nonce: Uint8Array } | null {
    this.sweep();
    const mine = this.byClient.get(client) ?? [];
    if (mine.length >= PER_CLIENT) this.m.delete(mine.shift()!);
    if (this.m.size >= MAX_OUTSTANDING) return null;
    const challengeId = ulid(), nonce = new Uint8Array(randomBytes(32));
    this.m.set(challengeId, { nonce, exp: this.now() + this.ttlMs, client });
    mine.push(challengeId);
    this.byClient.set(client, mine);
    return { challengeId, nonce };
  }

  /** Returns the nonce once; a second take, or a take after expiry, returns null. */
  take(id: string): Uint8Array | null {
    const entry = this.m.get(id);
    this.m.delete(id);
    if (entry) this.forget(entry.client, id);
    return entry && entry.exp >= this.now() ? entry.nonce : null;
  }

  private sweep() {
    const now = this.now();
    for (const [id, entry] of this.m) if (entry.exp < now) { this.m.delete(id); this.forget(entry.client, id); }
  }

  private forget(client: string, id: string) {
    const ids = this.byClient.get(client)?.filter((x) => x !== id);
    if (ids?.length) this.byClient.set(client, ids); else this.byClient.delete(client);
  }
}
