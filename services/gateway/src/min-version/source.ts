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

  constructor(source: MinVersionSource, ttlMs = 30_000, now: () => number = Date.now, initialDefault = '0.1.0') {
    this.source = source;
    this.ttlMs = ttlMs;
    this.now = now;
    this.lastGood = initialDefault;
  }

  async getMinVersion(): Promise<string> {
    const t = this.now();
    if (this.cached && t - this.cached.at < this.ttlMs) {
      return this.cached.value;
    }
    try {
      const v = await this.source.getMinVersion();
      if (typeof v === 'string' && v.trim().length > 0) {
        this.lastGood = v.trim();
      }
      this.cached = { value: this.lastGood, at: t };
    } catch {
      // If it fails, keep the last good value.
      this.cached = { value: this.lastGood, at: t };
    }
    return this.lastGood;
  }
}

