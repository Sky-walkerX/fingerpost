import type { TelemetryCollector } from './collector.ts';

export interface MonitoringOptions {
  enabled?: boolean;
  live?: boolean;
  singleInstance?: boolean;
  projectId: string;
  collector: TelemetryCollector;
  readSpend: (utcDay: string, signal: AbortSignal) => Promise<number>;
  getAccessToken: () => Promise<string>;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
}
export type ExportResult = { status: 'disabled' | 'failed' | 'no-data' | 'skipped' }
  | { status: 'exported'; series: number };

const PREFIX = 'custom.googleapis.com/fingerpost/';
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Explicitly enabled single-writer exporter; no request/response content reaches its results. */
export class MonitoringExporter {
  private readonly options: MonitoringOptions;
  private readonly now: () => number;
  private readonly fetch: typeof globalThis.fetch;
  private active: Promise<ExportResult> | undefined;
  private workPending = false;
  private controller: AbortController | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastAttemptAt = -Infinity;
  private lastWriteAt = -Infinity;

  constructor(options: MonitoringOptions) {
    if (options.enabled && (!options.live || !options.singleInstance)) {
      throw new Error('Telemetry requires live single-instance mode');
    }
    if (options.enabled && !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(options.projectId)) {
      throw new Error('Invalid telemetry project');
    }
    this.options = options;
    this.now = options.now ?? Date.now;
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  exportOnce(): Promise<ExportResult> {
    if (!this.options.enabled) return Promise.resolve({ status: 'disabled' });
    if (this.active) return this.active;
    if (this.workPending) return Promise.resolve({ status: 'skipped' });
    const now = this.now();
    // Failed HTTP writes may have partially succeeded. Never retry a timestamp automatically.
    if (now <= this.lastAttemptAt) return Promise.resolve({ status: 'skipped' });
    this.lastAttemptAt = now;
    this.active = this.run().finally(() => { this.active = undefined; });
    return this.active;
  }

  start(): void {
    if (this.timer || !this.options.enabled) return;
    this.timer = setInterval(() => { void this.exportOnce(); }, 60_000);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.controller?.abort();
  }

  private async run(): Promise<ExportResult> {
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 5000);
    timeout.unref();
    const aborted = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error('Telemetry timeout')), { once: true });
    });
    // SDK credential/ledger calls can ignore abort. Keep one underlying operation even after
    // the bounded caller returns, until that operation actually settles.
    this.workPending = true;
    const work = this.write(controller.signal).finally(() => { this.workPending = false; });
    try {
      return await Promise.race([work, aborted]);
    } catch {
      return { status: 'failed' };
    } finally {
      clearTimeout(timeout);
      this.controller = undefined;
    }
  }

  private async write(signal: AbortSignal): Promise<ExportResult> {
    const spendDay = day(this.now());
    let spend: number | undefined;
    try {
      const value = await this.options.readSpend(spendDay, signal);
      if (Number.isSafeInteger(value) && value >= 0 && day(this.now()) === spendDay) spend = value;
    } catch { /* Unknown spend is omitted; no previously read value is reused. */ }
    signal.throwIfAborted();
    const token = await this.options.getAccessToken();
    signal.throwIfAborted();
    if (!token) throw new Error('Telemetry credentials unavailable');
    const timestamp = this.now();
    if (timestamp <= this.lastWriteAt) return { status: 'skipped' };
    // Credential refresh can straddle midnight or outlive a sample window too.
    if (day(timestamp) !== spendDay) spend = undefined;
    const snapshot = this.options.collector.snapshot(timestamp);
    const values: [string, number | undefined, string][] = [
      ['task_error_ratio', snapshot.taskErrorRatio, '1'],
      ['parse_p95_seconds', snapshot.parseP95Seconds, 's'],
      ['daily_spend_micros', spend, '1'],
      ['export_heartbeat', 1, '1'],
      ['task_samples', snapshot.taskSamples, '1'],
      ['parse_samples', snapshot.parseSamples, '1'],
      ['task_overflow', Number(snapshot.taskOverflow), '1'],
      ['parse_overflow', Number(snapshot.parseOverflow), '1'],
      ['spend_read_ok', Number(spend !== undefined), '1'],
    ];
    const timeSeries = values.filter(([, value]) => value !== undefined).map(([metric, value, unit]) => ({
      metric: { type: PREFIX + metric },
      resource: { type: 'global', labels: { project_id: this.options.projectId } },
      metricKind: 'GAUGE', valueType: 'DOUBLE', unit,
      points: [{ interval: { endTime: new Date(timestamp).toISOString() }, value: { doubleValue: value } }],
    }));
    if (!timeSeries.length) return { status: 'no-data' };
    this.lastWriteAt = timestamp;
    const response = await this.fetch(
      `https://monitoring.googleapis.com/v3/projects/${this.options.projectId}/timeSeries`, {
        method: 'POST', redirect: 'error', signal,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ timeSeries }),
      });
    // Error bodies may contain identifying details. Status alone establishes success/failure.
    if (!response.ok) return { status: 'failed' };
    return { status: 'exported', series: timeSeries.length };
  }
}
