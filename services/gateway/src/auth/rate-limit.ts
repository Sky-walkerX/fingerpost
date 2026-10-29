const MAX_KEYS = 10_000;

/** Fixed-window limiter keyed by e.g. client IP. In memory: per instance, which is enough to blunt token farming. */
export class FixedWindowLimiter {
  private readonly hits = new Map<string, { n: number; windowStart: number }>();
  constructor(private readonly limit: number, private readonly windowMs: number, private readonly now: () => number = Date.now) {}

  /** true = allowed. */
  hit(key: string): boolean {
    const t = this.now();
    const e = this.hits.get(key);
    if (!e || t - e.windowStart >= this.windowMs) {
      if (!e && this.hits.size >= MAX_KEYS) {
        for (const [k, v] of this.hits) if (t - v.windowStart >= this.windowMs) this.hits.delete(k);
        if (this.hits.size >= MAX_KEYS) return false; // full of active keys: deny new ones rather than reset everyone
      }
      this.hits.set(key, { n: 1, windowStart: t });
      return true;
    }
    e.n++;
    return e.n <= this.limit;
  }
}
