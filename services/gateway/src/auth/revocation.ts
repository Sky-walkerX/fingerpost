import { z } from 'zod';

export const STATUS_URL = 'https://android.googleapis.com/attestation/status';
const StatusList = z.object({ entries: z.record(z.string(), z.unknown()) });

/**
 * Google's attestation revocation list (revoked and suspended serials). isRevoked throws while the list
 * is missing or older than maxAgeMs, so verifyAttestation fails closed.
 */
export class RevocationList {
  private serials: Set<string> | null = null;
  private loadedAt = 0;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly maxAgeMs: number;
  constructor(fetchImpl: typeof fetch = fetch, now: () => number = Date.now, maxAgeMs = 24 * 60 * 60_000) {
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.maxAgeMs = maxAgeMs;
  }

  async refresh(): Promise<void> {
    const res = await this.fetchImpl(STATUS_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`status list HTTP ${res.status}`);
    const list = StatusList.parse(await res.json());
    this.serials = new Set(Object.keys(list.entries).map((s) => s.toLowerCase().replace(/^0+/, '')));
    this.loadedAt = this.now();
  }

  readonly isRevoked = (serialHex: string): boolean => {
    if (!this.serials || this.now() - this.loadedAt > this.maxAgeMs) throw new Error('revocation list unavailable');
    return this.serials.has(serialHex);
  };

  /** Loads now and then every hour; failures keep the last good list until it goes stale. */
  start(intervalMs = 60 * 60_000, onError: (e: unknown) => void = () => {}): void {
    const load = () => { this.refresh().catch(onError); };
    load();
    setInterval(load, intervalMs).unref();
  }
}
