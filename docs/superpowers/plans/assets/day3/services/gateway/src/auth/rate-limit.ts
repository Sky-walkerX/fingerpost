/** Fixed-window limiter keyed by e.g. client IP. In memory: per instance, which is enough to blunt token farming. */
export class FixedWindowLimiter {
  private readonly hits = new Map<string, { n: number; windowStart: number }>();
  constructor(private readonly limit: number, private readonly windowMs: number, private readonly now: () => number = Date.now) {}

  /** true = allowed. */
  hit(key: string): boolean {
    const t = this.now();
    const e = this.hits.get(key);
    if (!e || t - e.windowStart >= this.windowMs) {
      if (this.hits.size > 10_000) this.hits.clear(); // bound memory under abuse
      this.hits.set(key, { n: 1, windowStart: t });
      return true;
    }
    e.n++;
    return e.n <= this.limit;
  }
}
