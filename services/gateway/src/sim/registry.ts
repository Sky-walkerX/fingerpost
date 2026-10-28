import { z } from 'zod';

export const SimEventBody = z.object({
  runId: z.string().min(1).max(64),
  screenId: z.string().min(1).max(64),
  x: z.number(), y: z.number(),
  u: z.number().min(0).max(1), v: z.number().min(0).max(1),
  elementId: z.string().min(1).max(64).nullable(),
  ts: z.number().int().nonnegative(),
});
export type SimEvent = z.infer<typeof SimEventBody>;
type Listener = (e: SimEvent) => void;

/** Links simulator runs to live sessions (hello.caps.simRunId). In-memory: one gateway instance per demo. */
export class SimRegistry {
  private readonly byRun = new Map<string, Set<Listener>>();
  subscribe(runId: string, l: Listener): () => void {
    const set = this.byRun.get(runId) ?? new Set<Listener>();
    set.add(l); this.byRun.set(runId, set);
    return () => { set.delete(l); if (set.size === 0 && this.byRun.get(runId) === set) this.byRun.delete(runId); };
  }
  /** Returns how many sessions received the event. */
  publish(e: SimEvent): number {
    const listeners = [...(this.byRun.get(e.runId) ?? [])];
    for (const listener of listeners) listener(e);
    return listeners.length;
  }
}
