const MAX_KEYS = 10_000;
/** An overflow bucket aggregates a whole /16 or /32, so it gets proportionally more room than one client. */
const OVERFLOW_FACTOR = 20;

type Window = { n: number; windowStart: number };

/**
 * Fixed-window limiter keyed by client prefix. In memory: per instance, which is enough to blunt token farming.
 * Active windows are never dropped. When the table is full of active keys, a new key shares a coarser overflow
 * bucket (its /16 or /32) that keeps its count, so churning addresses can neither reset limits nor lock others out.
 */
export class FixedWindowLimiter {
  private readonly hits = new Map<string, Window>();
  private readonly overflow = new Map<string, Window>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }

  /** true = allowed. */
  hit(key: string, overflowKey = '*'): boolean {
    const t = this.now();
    if (!this.hits.has(key) && this.hits.size >= MAX_KEYS) {
      this.sweep(this.hits, t);
      if (this.hits.size >= MAX_KEYS) {
        if (!this.overflow.has(overflowKey) && this.overflow.size >= MAX_KEYS) this.sweep(this.overflow, t);
        if (!this.overflow.has(overflowKey) && this.overflow.size >= MAX_KEYS) return false;
        return this.count(this.overflow, overflowKey, t, this.limit * OVERFLOW_FACTOR);
      }
    }
    return this.count(this.hits, key, t, this.limit);
  }

  private count(m: Map<string, Window>, key: string, t: number, limit: number): boolean {
    const e = m.get(key);
    if (!e || t - e.windowStart >= this.windowMs) {
      m.set(key, { n: 1, windowStart: t });
      return true;
    }
    e.n++;
    return e.n <= limit;
  }

  private sweep(m: Map<string, Window>, t: number) {
    for (const [k, v] of m) if (t - v.windowStart >= this.windowMs) m.delete(k);
  }
}

const ipv6Groups = (ip: string) => {
  const [head = '', tail = ''] = ip.split('::');
  const left = head ? head.split(':') : [], right = tail ? tail.split(':') : [];
  return [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
};
const isV4 = (ip: string) => !ip.includes(':') || ip.startsWith('::ffff:');

/** Rate-limit key for a client IP: IPv4 as is, IPv6 by /56 so one allocation can't spray addresses. */
export function clientKey(ip: string): string {
  if (isV4(ip)) return ip.replace(/^::ffff:/, '');
  const g = ipv6Groups(ip);
  return `${g.slice(0, 3).join(':')}:${(parseInt(g[3] ?? '0', 16) & 0xff00).toString(16)}::/56`;
}

/** The coarser overflow bucket: IPv4 /16, IPv6 /32. */
export function overflowKey(ip: string): string {
  if (isV4(ip)) return `${ip.replace(/^::ffff:/, '').split('.').slice(0, 2).join('.')}.0.0/16`;
  return `${ipv6Groups(ip).slice(0, 2).join(':')}::/32`;
}
