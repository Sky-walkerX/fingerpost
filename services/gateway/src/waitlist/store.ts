export interface WaitlistEntry {
  email: string;
  locale: 'en' | 'hi' | 'es';
  createdAt: number;
}

export interface WaitlistStore {
  add(entry: WaitlistEntry): Promise<boolean | void>;
}

/** In-memory store for mock/dev and tests. Deduplicates by trimmed, lowercased email. */
export class MemoryWaitlistStore implements WaitlistStore {
  readonly entries: WaitlistEntry[] = [];

  get records(): WaitlistEntry[] {
    return this.entries;
  }

  has(email: string): boolean {
    const norm = email.trim().toLowerCase();
    return this.entries.some((e) => e.email === norm);
  }

  async add(entry: WaitlistEntry): Promise<boolean> {
    const norm = entry.email.trim().toLowerCase();
    if (this.entries.some((e) => e.email === norm)) {
      return false;
    }
    this.entries.push({
      email: norm,
      locale: entry.locale,
      createdAt: entry.createdAt,
    });
    return true;
  }

  async store(entry: WaitlistEntry): Promise<boolean> {
    return this.add(entry);
  }

  async save(entry: WaitlistEntry): Promise<boolean> {
    return this.add(entry);
  }

  async record(entry: WaitlistEntry): Promise<boolean> {
    return this.add(entry);
  }
}

