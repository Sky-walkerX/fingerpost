export type BreakerState = 'closed' | 'open' | 'half-open';

/**
 * Days 4–7 plan, B5-3 (design §4.4): opens after 5 failures within 30 s, then refuses calls for 20 s.
 * After that one trial call goes through (half-open): success closes it, failure opens it again.
 */
export class Breaker {
  state: BreakerState = 'closed';
  private failures: number[] = [];
  private openedAt = 0;
  private trialOut = false;
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly openMs: number;
  private readonly now: () => number;

  constructor(o: { limit?: number; windowMs?: number; openMs?: number; now?: () => number } = {}) {
    this.limit = o.limit ?? 5;
    this.windowMs = o.windowMs ?? 30_000;
    this.openMs = o.openMs ?? 20_000;
    this.now = o.now ?? Date.now;
  }

  allow(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open' && this.now() - this.openedAt >= this.openMs) { this.state = 'half-open'; this.trialOut = false; }
    if (this.state === 'half-open' && !this.trialOut) { this.trialOut = true; return true; }
    return false;
  }

  success(): void {
    this.state = 'closed';
    this.failures = [];
    this.trialOut = false;
  }

  failure(): void {
    const now = this.now();
    if (this.state === 'half-open') return this.open(now);
    this.failures = [...this.failures.filter((t) => now - t < this.windowMs), now];
    if (this.failures.length >= this.limit) this.open(now);
  }

  private open(now: number): void {
    this.state = 'open';
    this.openedAt = now;
    this.failures = [];
    this.trialOut = false;
  }
}
