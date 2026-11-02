import { afterEach, expect, test, vi } from 'vitest';
import { TelemetryCollector } from '../src/telemetry/collector.ts';
import { MonitoringExporter } from '../src/telemetry/exporter.ts';

const T0 = Date.UTC(2026, 10, 2, 12);
afterEach(() => vi.useRealTimers());

test('task sink records one terminal outcome and excludes cancellation', () => {
  const collector = new TelemetryCollector(() => T0);
  const finish = collector.beginTask();
  finish('error'); finish('success');
  collector.beginTask()('success'); collector.beginTask()('cancelled');
  expect(collector.snapshot()).toMatchObject({ taskSamples: 2, taskErrorRatio: 0.5 });
  expect(collector.snapshot().parseP95Seconds).toBeUndefined();
});

test('p95 uses all samples and exact rolling window; no samples never becomes zero', () => {
  let now = T0;
  const collector = new TelemetryCollector(() => now);
  for (let n = 1; n <= 20; n++) collector.recordParse(n * 1000);
  expect(collector.snapshot().parseP95Seconds).toBe(19);
  now += 299_999;
  expect(collector.snapshot().parseSamples).toBe(20);
  now++;
  expect(collector.snapshot()).toMatchObject({ taskSamples: 0, parseSamples: 0 });
  expect(collector.snapshot().parseP95Seconds).toBeUndefined();
  for (const duration of [-1, Infinity, NaN]) collector.recordParse(duration);
  expect(collector.snapshot().parseSamples).toBe(0);
});

test('overflow suppresses an affected metric rather than biasing p95 or error ratio', () => {
  let now = T0;
  const collector = new TelemetryCollector(() => now, 2);
  for (let n = 0; n < 3; n++) { collector.recordTask('error'); collector.recordParse(n); }
  expect(collector.snapshot()).toMatchObject({ taskOverflow: true, parseOverflow: true });
  expect(collector.snapshot().taskErrorRatio).toBeUndefined();
  expect(collector.snapshot().parseP95Seconds).toBeUndefined();
  now += 300_000;
  collector.recordTask('success'); collector.recordParse(5000);
  expect(collector.snapshot()).toMatchObject({ taskOverflow: false, parseOverflow: false,
    taskErrorRatio: 0, parseP95Seconds: 5 });
});

function setup(overrides: Partial<ConstructorParameters<typeof MonitoringExporter>[0]> = {}) {
  const collector = new TelemetryCollector(() => T0);
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('{}'));
  const readSpend = vi.fn(async (_day: string, _signal: AbortSignal) => 9_600_001);
  const getAccessToken = vi.fn(async () => 'synthetic-token');
  const exporter = new MonitoringExporter({ enabled: true, live: true, singleInstance: true,
    projectId: 'synthetic-project', collector, fetch, readSpend, getAccessToken, now: () => T0,
    ...overrides });
  return { collector, fetch, readSpend, getAccessToken, exporter };
}

test('REST export has only fixed numeric gauges and fresh ledger data; no labels or content', async () => {
  const { collector, fetch, readSpend, exporter } = setup();
  collector.recordTask('error'); collector.recordTask('success'); collector.recordParse(5001);
  expect(await exporter.exportOnce()).toEqual({ status: 'exported', series: 3 });
  expect(readSpend).toHaveBeenCalledWith('2026-11-02', expect.any(AbortSignal));
  const [url, options] = fetch.mock.calls[0]!;
  expect(url).toBe('https://monitoring.googleapis.com/v3/projects/synthetic-project/timeSeries');
  expect(options?.headers).toEqual({ authorization: 'Bearer synthetic-token', 'content-type': 'application/json' });
  const body = JSON.parse(String(options?.body));
  expect(body.timeSeries.map((s: { points: { value: unknown }[] }) => s.points[0]?.value))
    .toEqual([{ doubleValue: 0.5 }, { doubleValue: 5.001 }, { doubleValue: 9_600_001 }]);
  for (const series of body.timeSeries) {
    expect(series.metric).toEqual({ type: expect.stringMatching(/^custom.googleapis.com\/fingerpost\//) });
    expect(series.resource).toEqual({ type: 'global', labels: { project_id: 'synthetic-project' } });
    expect(series.metricKind).toBe('GAUGE'); expect(series.valueType).toBe('DOUBLE');
    expect(series.points[0].interval).toEqual({ endTime: new Date(T0).toISOString() });
  }
  expect(options?.signal).toBeInstanceOf(AbortSignal);
});

test('disabled exporter never reads credentials or ledger; live and single-writer guards fail closed', async () => {
  const state = setup({ enabled: false });
  expect(await state.exporter.exportOnce()).toEqual({ status: 'disabled' });
  expect(state.fetch).not.toHaveBeenCalled(); expect(state.readSpend).not.toHaveBeenCalled();
  expect(state.getAccessToken).not.toHaveBeenCalled();
  expect(() => setup({ live: false })).toThrow('Telemetry requires live single-instance mode');
  expect(() => setup({ singleInstance: false })).toThrow('Telemetry requires live single-instance mode');
  expect(() => setup({ projectId: 'bad/project' })).toThrow('Invalid telemetry project');
});

test('empty sample windows omit gauges; ledger errors do not reuse old spend or expose errors', async () => {
  let failed = false;
  let now = T0;
  const state = setup({ now: () => now,
    readSpend: async () => { if (failed) throw new Error('synthetic private content'); return 120; } });
  expect(await state.exporter.exportOnce()).toEqual({ status: 'exported', series: 1 });
  failed = true; now += 60_000;
  expect(await state.exporter.exportOnce()).toEqual({ status: 'no-data' });
  expect(state.fetch).toHaveBeenCalledTimes(1);
});

test('UTC rollover while reading spend omits the previous day total', async () => {
  let now = Date.UTC(2026, 10, 2, 23, 59, 59);
  const state = setup({ now: () => now,
    readSpend: async () => { now += 2000; return 100; } });
  expect(await state.exporter.exportOnce()).toEqual({ status: 'no-data' });
  expect(state.fetch).not.toHaveBeenCalled();
});

test('credential refresh crossing UTC midnight cannot publish the previous day spend', async () => {
  let now = Date.UTC(2026, 10, 2, 23, 59, 59);
  const state = setup({ now: () => now,
    getAccessToken: async () => { now += 2000; return 'synthetic-token'; } });
  expect(await state.exporter.exportOnce()).toEqual({ status: 'no-data' });
  expect(state.fetch).not.toHaveBeenCalled();
});

test('invalid ledger values are unknown; a verified UTC day reset publishes real zero', async () => {
  for (const value of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    const state = setup({ readSpend: async () => value });
    expect(await state.exporter.exportOnce()).toEqual({ status: 'no-data' });
    expect(state.fetch).not.toHaveBeenCalled();
  }
  const state = setup({ readSpend: async () => 0 });
  expect(await state.exporter.exportOnce()).toEqual({ status: 'exported', series: 1 });
  const body = JSON.parse(String(state.fetch.mock.calls[0]![1]!.body));
  expect(body.timeSeries[0].points[0].value).toEqual({ doubleValue: 0 });
});

test('concurrent exports share one request and repeated timestamps never write twice', async () => {
  let release!: (value: number) => void;
  const state = setup({ readSpend: () => new Promise<number>((resolve) => { release = resolve; }) });
  const first = state.exporter.exportOnce();
  const second = state.exporter.exportOnce();
  release(100);
  expect(await first).toEqual({ status: 'exported', series: 1 });
  expect(await second).toEqual({ status: 'exported', series: 1 });
  expect(state.fetch).toHaveBeenCalledTimes(1);
  expect(await state.exporter.exportOnce()).toEqual({ status: 'skipped' });
});

test('REST rejection is content-free, consumes no response body and never retries', async () => {
  const response = new Response('synthetic private content', { status: 403 });
  const state = setup({ fetch: vi.fn(async () => response) });
  expect(await state.exporter.exportOnce()).toEqual({ status: 'failed' });
  expect(response.bodyUsed).toBe(false);
});

test('five-second bound covers stuck credentials/ledger and cancels HTTP without retries', async () => {
  vi.useFakeTimers();
  const state = setup({ readSpend: async () => new Promise<number>(() => {}) });
  const run = state.exporter.exportOnce();
  await vi.advanceTimersByTimeAsync(5000);
  expect(await run).toEqual({ status: 'failed' });
  expect(state.fetch).not.toHaveBeenCalled();
  const requests = vi.fn<typeof globalThis.fetch>(async (_url, options) =>
    new Promise<Response>((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('private')))));
  const http = setup({ fetch: requests });
  const attempt = http.exporter.exportOnce();
  await vi.advanceTimersByTimeAsync(5000);
  expect(await attempt).toEqual({ status: 'failed' });
  expect(requests).toHaveBeenCalledTimes(1);
  expect(requests.mock.calls[0]![1]!.signal!.aborted).toBe(true);
});

test('timeout then late credential resolution cannot send a stale request', async () => {
  vi.useFakeTimers();
  let release!: (value: string) => void;
  const state = setup({ getAccessToken: () => new Promise<string>((resolve) => { release = resolve; }) });
  const attempt = state.exporter.exportOnce();
  await vi.advanceTimersByTimeAsync(5000);
  expect(await attempt).toEqual({ status: 'failed' });
  release('synthetic-token');
  await vi.advanceTimersByTimeAsync(0);
  expect(state.fetch).not.toHaveBeenCalled();
});

test('a timed-out uncancellable ledger read remains the only underlying operation', async () => {
  vi.useFakeTimers();
  let now = T0;
  const readSpend = vi.fn(async () => new Promise<number>(() => {}));
  const state = setup({ now: () => now, readSpend });
  const first = state.exporter.exportOnce();
  await vi.advanceTimersByTimeAsync(5000);
  expect(await first).toEqual({ status: 'failed' });
  for (let n = 0; n < 3; n++) {
    now += 60_000;
    const next = state.exporter.exportOnce();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await next).toEqual({ status: 'skipped' });
  }
  expect(readSpend).toHaveBeenCalledTimes(1);
  expect(state.fetch).not.toHaveBeenCalled();
});

test('late ledger settlement releases the underlying latch without posting aborted samples', async () => {
  vi.useFakeTimers();
  let now = T0;
  let release!: (value: number) => void;
  const readSpend = vi.fn(async () => 100)
    .mockImplementationOnce(() => new Promise<number>((resolve) => { release = resolve; }));
  const state = setup({ now: () => now, readSpend });
  const first = state.exporter.exportOnce();
  await vi.advanceTimersByTimeAsync(5000);
  expect(await first).toEqual({ status: 'failed' });
  now += 60_000;
  expect(await state.exporter.exportOnce()).toEqual({ status: 'skipped' });
  state.exporter.stop(); state.exporter.stop();
  release(999);
  await vi.advanceTimersByTimeAsync(0);
  expect(state.fetch).not.toHaveBeenCalled();
  expect(state.getAccessToken).not.toHaveBeenCalled();
  now += 60_000;
  expect(await state.exporter.exportOnce()).toEqual({ status: 'exported', series: 1 });
  expect(readSpend).toHaveBeenCalledTimes(2);
  expect(state.fetch).toHaveBeenCalledTimes(1);
});

test('stop bounds the caller while retaining the latch for uncancellable credential refresh', async () => {
  vi.useFakeTimers();
  let now = T0;
  const getAccessToken = vi.fn(async () => new Promise<string>(() => {}));
  const state = setup({ now: () => now, getAccessToken });
  const first = state.exporter.exportOnce();
  await vi.advanceTimersByTimeAsync(0);
  state.exporter.stop();
  expect(await first).toEqual({ status: 'failed' });
  now += 60_000;
  const next = state.exporter.exportOnce();
  await vi.advanceTimersByTimeAsync(5000);
  expect(await next).toEqual({ status: 'skipped' });
  expect(getAccessToken).toHaveBeenCalledTimes(1);
  expect(state.readSpend).toHaveBeenCalledTimes(1);
});

test('scheduler emits every minute, is idempotent and stops on disposal', async () => {
  vi.useFakeTimers();
  let now = T0;
  const state = setup({ now: () => now });
  state.exporter.start(); state.exporter.start();
  expect(state.fetch).not.toHaveBeenCalled();
  now += 60_000; await vi.advanceTimersByTimeAsync(60_000);
  expect(state.fetch).toHaveBeenCalledTimes(1);
  state.exporter.stop();
  now += 60_000; await vi.advanceTimersByTimeAsync(60_000);
  expect(state.fetch).toHaveBeenCalledTimes(1);
});
