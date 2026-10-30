import type { QuotaPort, StartResult, Tier } from '../session/types.ts';
import { costMicros, type Usage } from './cost.ts';
import type { FlagStore, QuotaStore } from './ports.ts';

export interface QuotaConfig {
  /** Guided tasks per user per UTC day (design §4.5 default 30; software-attested devices get fewer). */
  tasksPerDay: Record<Tier, number>;
  /** Global daily spend cap in µ$ ($12/day during the hackathon = 12_000_000). */
  dailyCapMicros: number;
  /** How long the kill-switch flag is cached (design: 30 s). */
  flagCacheMs: number;
}
export const DEFAULT_QUOTA: QuotaConfig = { tasksPerDay: { hardware: 30, software: 10 }, dailyCapMicros: 12_000_000, flagCacheMs: 30_000 };

export type { StartResult };

export const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export class QuotaService implements QuotaPort {
  private cache: { value: boolean; at: number } | null = null;
  private readonly store: QuotaStore;
  private readonly flags: FlagStore;
  private readonly cfg: QuotaConfig;
  private readonly now: () => number;
  constructor(store: QuotaStore, flags: FlagStore, cfg: QuotaConfig = DEFAULT_QUOTA, now: () => number = Date.now) {
    this.store = store;
    this.flags = flags;
    this.cfg = cfg;
    this.now = now;
  }

  async cloudEnabled(): Promise<boolean> {
    const now = this.now();
    if (this.cache && now - this.cache.at < this.cfg.flagCacheMs) return this.cache.value;
    const value = await this.flags.getCloudEnabled();
    this.cache = { value, at: now };
    return value;
  }

  /** Call when a guided task starts (first locate keyframe for a new goal). Paused cloud wins over quota. */
  async startTask(uid: string, tier: Tier): Promise<StartResult> {
    if (!(await this.cloudEnabled())) return { ok: false, code: 'cloud_paused' };
    const limit = this.cfg.tasksPerDay[tier];
    const n = await this.store.incrementTasks(uid, utcDay(this.now()));
    return n > limit ? { ok: false, code: 'quota_exhausted' } : { ok: true, tasksLeft: limit - n };
  }

  /** Call after every billed model call. Flips the kill switch when the day's total reaches the cap. */
  async recordUsage(u: Usage): Promise<number> {
    const total = await this.store.addSpend(utcDay(this.now()), costMicros(u));
    if (total >= this.cfg.dailyCapMicros) {
      await this.flags.setCloudEnabled(false, `daily cap reached (${total} µ$)`);
      this.cache = { value: false, at: this.now() };
    }
    return total;
  }
}
