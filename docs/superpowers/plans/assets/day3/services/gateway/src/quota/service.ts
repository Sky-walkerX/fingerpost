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

export const utcDay = (ms: number) => { throw new Error('TODO(D3-T7): implement this; the tests describe the behaviour'); };

export class QuotaService implements QuotaPort {
  private cache: { value: boolean; at: number } | null = null;
  constructor(private readonly store: QuotaStore, private readonly flags: FlagStore, private readonly cfg: QuotaConfig = DEFAULT_QUOTA, private readonly now: () => number = Date.now) {}

  async cloudEnabled(): Promise<boolean> {
    throw new Error('TODO(D3-T7): implement this; the tests describe the behaviour');
  }

  /** Call when a guided task starts (first locate keyframe for a new goal). Paused cloud wins over quota. */
  async startTask(uid: string, tier: Tier): Promise<StartResult> {
    throw new Error('TODO(D3-T7): implement this; the tests describe the behaviour');
  }

  /** Call after every billed model call. Flips the kill switch when the day's total reaches the cap. */
  async recordUsage(u: Usage): Promise<number> {
    throw new Error('TODO(D3-T7): implement this; the tests describe the behaviour');
  }
}
