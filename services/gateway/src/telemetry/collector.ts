export type TaskOutcome = 'success' | 'error' | 'cancelled';
export interface TelemetrySnapshot {
  taskErrorRatio?: number;
  parseP95Seconds?: number;
  taskSamples: number;
  parseSamples: number;
  taskOverflow: boolean;
  parseOverflow: boolean;
}

const WINDOW_MS = 300_000;
interface NumericSample { at: number; value: number; }

/** One production instance only. No identifiers or content enter the collector. */
export class TelemetryCollector {
  private readonly now: () => number;
  private readonly maxSamples: number;
  private readonly tasks: NumericSample[] = [];
  private readonly parses: NumericSample[] = [];
  private taskOverflowUntil = -Infinity;
  private parseOverflowUntil = -Infinity;

  constructor(now: () => number = Date.now, maxSamples = 10_000) {
    if (!Number.isSafeInteger(maxSamples) || maxSamples < 1 || maxSamples > 100_000) {
      throw new Error('Invalid telemetry window bound');
    }
    this.now = now;
    this.maxSamples = maxSamples;
  }

  beginTask(): (outcome: TaskOutcome) => void {
    let finished = false;
    return (outcome) => {
      if (finished) return;
      finished = true;
      this.recordTask(outcome);
    };
  }

  recordTask(outcome: TaskOutcome): void {
    if (outcome === 'cancelled') return;
    const now = this.now();
    this.prune(this.tasks, now);
    if (this.tasks.length >= this.maxSamples) {
      this.taskOverflowUntil = now + WINDOW_MS;
      return;
    }
    this.tasks.push({ at: now, value: outcome === 'error' ? 1 : 0 });
  }

  recordParse(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    const now = this.now();
    this.prune(this.parses, now);
    if (this.parses.length >= this.maxSamples) {
      this.parseOverflowUntil = now + WINDOW_MS;
      return;
    }
    this.parses.push({ at: now, value: durationMs / 1000 });
  }

  snapshot(now = this.now()): TelemetrySnapshot {
    this.prune(this.tasks, now); this.prune(this.parses, now);
    const result: TelemetrySnapshot = {
      taskSamples: this.tasks.length, parseSamples: this.parses.length,
      taskOverflow: now < this.taskOverflowUntil, parseOverflow: now < this.parseOverflowUntil,
    };
    if (this.tasks.length && !result.taskOverflow) {
      result.taskErrorRatio = this.tasks.reduce((sum, sample) => sum + sample.value, 0) / this.tasks.length;
    }
    if (this.parses.length && !result.parseOverflow) {
      const sorted = this.parses.map((sample) => sample.value).sort((a, b) => a - b);
      result.parseP95Seconds = sorted[Math.ceil(sorted.length * 0.95) - 1]!;
    }
    return result;
  }

  private prune(samples: NumericSample[], now: number): void {
    // Keep (now - 300 seconds, now]; the fixed cap bounds memory even during a traffic burst.
    let expired = 0;
    while (expired < samples.length && samples[expired]!.at <= now - WINDOW_MS) expired++;
    if (expired) samples.splice(0, expired);
  }
}
