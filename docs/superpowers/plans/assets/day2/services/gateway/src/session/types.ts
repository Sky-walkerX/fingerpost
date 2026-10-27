import type { Usage } from '../quota/cost.ts';

/** Shared by the session controller (Day 2) and auth/quota (Day 3), so Day 2 compiles without Day 3 code. */
export type Tier = 'hardware' | 'software';
export interface SessionClaims { uid: string; keyId: string; tier: Tier; }
export type StartResult = { ok: true; tasksLeft: number } | { ok: false; code: 'quota_exhausted' | 'cloud_paused' };
export interface QuotaPort {
  /** Once per new goal, before its first locate. */
  startTask(uid: string, tier: Tier): Promise<StartResult>;
  /** After every billed model call; returns the day's total in µ$. */
  recordUsage(u: Usage): Promise<number>;
}
