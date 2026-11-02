import { expect, test, vi } from 'vitest';
import { TelemetryCollector } from '../src/telemetry/collector.ts';
import { MonitoringExporter } from '../src/telemetry/exporter.ts';

test('idle traffic still exports a heartbeat and explicit sample counts without fake latency or error ratios', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('{}'));
  const exporter = new MonitoringExporter({ enabled: true, live: true, singleInstance: true, projectId: 'synthetic-project',
    collector: new TelemetryCollector(), readSpend: async () => { throw new Error('synthetic'); }, getAccessToken: async () => 'synthetic', fetch });
  expect(await exporter.exportOnce()).toEqual({ status: 'exported', series: 6 });
  const body = JSON.parse(String(fetch.mock.calls[0]![1]!.body));
  const values = Object.fromEntries(body.timeSeries.map((s: { metric: { type: string }; points: { value: { doubleValue: number } }[] }) =>
    [s.metric.type.split('/').at(-1), s.points[0]!.value.doubleValue]));
  expect(values).toEqual({ export_heartbeat: 1, task_samples: 0, parse_samples: 0, task_overflow: 0, parse_overflow: 0, spend_read_ok: 0 });
});

test('overflow and ledger recovery are visible without publishing biased aggregates', async () => {
  const collector = new TelemetryCollector(Date.now, 1);
  collector.recordTask('error'); collector.recordTask('error'); collector.recordParse(1); collector.recordParse(2);
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('{}'));
  const exporter = new MonitoringExporter({ enabled: true, live: true, singleInstance: true, projectId: 'synthetic-project', collector,
    readSpend: async () => 0, getAccessToken: async () => 'synthetic', fetch });
  await exporter.exportOnce();
  const series = JSON.parse(String(fetch.mock.calls[0]![1]!.body)).timeSeries;
  const value = (name: string) => series.find((s: { metric: { type: string } }) => s.metric.type.endsWith('/' + name))?.points[0].value.doubleValue;
  expect(value('task_overflow')).toBe(1); expect(value('parse_overflow')).toBe(1); expect(value('spend_read_ok')).toBe(1);
  expect(value('task_error_ratio')).toBeUndefined(); expect(value('parse_p95_seconds')).toBeUndefined();
});
