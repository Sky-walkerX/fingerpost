import { AppVersion } from './version.ts';

export interface MinVersionSource {
  getMinVersion(): Promise<string>;
}

/** In-memory min version source for mock/dev and tests. Default: "0.1.0". */
export class MemoryMinVersionSource implements MinVersionSource {
  reads = 0;
  version: string;

  constructor(version = '0.1.0') {
    this.version = version;
  }

  async getMinVersion(): Promise<string> {
    this.reads++;
    return this.version;
  }
}

/**
 * 30-second cached wrapper around a MinVersionSource.
 * If fetching from the underlying source fails, it preserves and returns the last good value.
 */
export class CachedMinVersionSource implements MinVersionSource {
  private readonly source: MinVersionSource;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private cached: { value: string; at: number } | null = null;
  private lastGood: string;
  private pending: Promise<string> | undefined;
  private workPending = false;

  constructor(source: MinVersionSource, ttlMs = 30_000, now: () => number = Date.now, initialDefault = '0.1.0') {
    this.source = source;
    this.ttlMs = ttlMs;
    this.now = now;
    this.lastGood = AppVersion.parse(initialDefault);
  }

  async getMinVersion(): Promise<string> {
    const t = this.now();
    if (this.cached && t - this.cached.at < this.ttlMs) {
      return this.cached.value;
    }
    if (this.pending) return this.pending;
    // An SDK operation may ignore cancellation: never accumulate more refresh work behind it.
    if (this.workPending) {
      this.cached = { value: this.lastGood, at: t };
      return this.lastGood;
    }
    this.workPending = true;
    let active = true;
    const work = Promise.resolve().then(() => this.source.getMinVersion()).then(value => {
      const parsed = AppVersion.safeParse(typeof value === 'string' ? value.trim() : value);
      if (active && parsed.success) this.lastGood = parsed.data;
    }).catch(() => {}).finally(() => { this.workPending = false; });
    this.pending = new Promise<string>(resolve => {
      let timer: ReturnType<typeof setTimeout>;
      const finish = () => {
        if (!active) return;
        active = false; clearTimeout(timer);
        this.cached = { value: this.lastGood, at: this.now() };
        resolve(this.lastGood);
      };
      timer = setTimeout(finish, 5000);
      void work.then(finish);
    }).finally(() => { this.pending = undefined; });
    return this.pending;
  }
}

