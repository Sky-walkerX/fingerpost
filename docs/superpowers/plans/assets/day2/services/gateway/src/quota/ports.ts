/** Storage behind quotas and the kill switch. Firestore in production (firestore-stores.ts), memory in tests. */
export interface QuotaStore {
  /** Atomically increments and returns the user's task count for `day`. */
  incrementTasks(uid: string, day: string): Promise<number>;
  /** Atomically adds µ$ to the day's spend and returns the new day total. */
  addSpend(day: string, micros: number): Promise<number>;
}
export interface FlagStore {
  getCloudEnabled(): Promise<boolean>;
  setCloudEnabled(enabled: boolean, reason: string): Promise<void>;
}

export class MemoryQuotaStore implements QuotaStore {
  readonly tasks = new Map<string, number>();
  readonly spend = new Map<string, number>();
  async incrementTasks(uid: string, day: string) { const k = `${day}/${uid}`; const n = (this.tasks.get(k) ?? 0) + 1; this.tasks.set(k, n); return n; }
  async addSpend(day: string, micros: number) { const n = (this.spend.get(day) ?? 0) + micros; this.spend.set(day, n); return n; }
}
export class MemoryFlagStore implements FlagStore {
  reads = 0;
  constructor(public enabled = true, public reason = '') {}
  async getCloudEnabled() { this.reads++; return this.enabled; }
  async setCloudEnabled(enabled: boolean, reason: string) { this.enabled = enabled; this.reason = reason; }
}
