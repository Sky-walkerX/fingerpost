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
        // Still full of active keys: drop the oldest window (Map keeps insertion order), never reset everyone.
        if (this.hits.size >= MAX_KEYS) this.hits.delete(this.hits.keys().next().value!);
      }
      this.hits.set(key, { n: 1, windowStart: t });
      return true;
    }
    e.n++;
    return e.n <= this.limit;
  }
}

/** Rate-limit key for a client IP: IPv4 as is, IPv6 by /56 so one allocation can't spray addresses. */
export function clientKey(ip: string): string {
  if (!ip.includes(':') || ip.startsWith('::ffff:')) return ip.replace(/^::ffff:/, '');
  const [head = '', tail = ''] = ip.split('::');
  const left = head ? head.split(':') : [], right = tail ? tail.split(':') : [];
  const groups = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  return `${groups.slice(0, 3).join(':')}:${(parseInt(groups[3] ?? '0', 16) & 0xff00).toString(16)}::/56`;
}
