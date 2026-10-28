import type { SocketOptions } from '../src/debug/asr-probe.ts';
import type { TimingSummary } from './latency-runner.ts';
import { parseLatencyArguments } from './latency-runner.ts';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { encodeFrame, Goal, LIMITS, PROTOCOL } from '@fingerpost/protocol';
import { socketExchange } from '../src/debug/socket.ts';
import { AsrMetrics, BenchmarkAuth, BenchmarkEnvelope } from '../src/debug/region-metrics.ts';
import { jpegSize } from '../src/debug/jpeg.ts';
import { normalizeLabel } from '../src/parse/spark-parse.ts';

export interface TargetMeasurement {
  mode: 'mock' | 'live'; sparkMs: number; samMs: number; keyframeToTargetMs: number; samRefined: number;
}
export interface FullRegionMeasurements {
  mode: 'mock' | 'live'; samples: number; maskFallbacks: number;
  rttMs: TimingSummary; asrConnectMs: TimingSummary; asrReadyMs: TimingSummary;
  sparkMs: TimingSummary; samMs: TimingSummary; keyframeToTargetMs: TimingSummary;
}
export interface RegionOptions extends SocketOptions { fetcher?: typeof fetch; now?: () => number; }

function preflight(url: URL, image: Uint8Array, token: string, goal: string, samples: number): void {
  parseLatencyArguments([url.href, '--n', String(samples)]);
  const size = jpegSize(image);
  if (size.width !== 1024 || size.height !== 576 || image.length > LIMITS.keyframeBytes ||
      token.length < 16 || token.length > 4096 || !Goal.shape.text.safeParse(goal).success || !normalizeLabel(goal))
    throw new Error('Invalid private benchmark inputs');
}

export async function measureTarget(
  url: URL, image: Uint8Array, token: string, goal: string, options: RegionOptions = {},
): Promise<TargetMeasurement> {
  preflight(url, image, token, goal, 1);
  const endpoint = new URL('/v1/debug/region-target', url);
  endpoint.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const now = options.now ?? (() => performance.now());
  let stage: 'auth' | 'ready' | 'goal' | 'target' = 'auth';
  let mode: 'mock' | 'live' = 'mock', started = 0;
  const base = () => ({ id: randomUUID(), ts: Date.now() });
  return socketExchange(endpoint.href, options, 'Target measurement failed', (socket) => {
    socket.send(JSON.stringify({ token }));
  }, (data, socket) => {
    if (stage === 'auth') {
      mode = BenchmarkAuth.parse(data).mode;
      stage = 'ready';
      socket.send(JSON.stringify({ ...base(), type: 'hello', appVersion: 'region-benchmark', protocol: PROTOCOL,
        locale: 'en', mode: 'guide', privacy: 'normal', caps: {} }));
      return;
    }
    const envelope = BenchmarkEnvelope.parse(data);
    const message = envelope.message;
    if (stage === 'ready' && message.type === 'ready') {
      stage = 'goal';
      socket.send(JSON.stringify({ ...base(), type: 'goal', text: goal, source: 'typed' }));
      return;
    }
    if (stage === 'goal' && message.type === 'goal.ack' && message.goal === goal) {
      stage = 'target';
      const frame = encodeFrame({ ...base(), type: 'keyframe', kind: 'screen', purpose: 'locate',
        imageSize: { w: 1024, h: 576 }, ocrTokens: [] }, image);
      started = now();
      socket.send(frame);
      return;
    }
    if (stage !== 'target' || message.type !== 'target' || !envelope.timings) throw new Error('Invalid target reply');
    const keyframeToTargetMs = now() - started;
    if (!Number.isFinite(keyframeToTargetMs) || keyframeToTargetMs < 0) throw new Error('Invalid timing');
    const { sparkMs, samMs, samRefined } = envelope.timings;
    return { mode, sparkMs, samMs, samRefined, keyframeToTargetMs };
  });
}

export async function measureFullRegion(
  url: URL, image: Uint8Array, token: string, goal: string, samples: number, options: RegionOptions = {},
): Promise<FullRegionMeasurements> {
  preflight(url, image, token, goal, samples);
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => performance.now());
  const rtt: number[] = [], connect: number[] = [], ready: number[] = [], spark: number[] = [], sam: number[] = [], total: number[] = [];
  let mode: 'mock' | 'live' | undefined, maskFallbacks = 0;
  try {
    for (let index = 0; index < samples; index++) {
      const started = now();
      const health = await fetcher(new URL('/healthz', url), { redirect: 'error', signal: AbortSignal.timeout(60_000) });
      if (!health.ok) throw new Error('Unhealthy region');
      z.object({ status: z.literal('ok'), protocol: z.literal(PROTOCOL) }).parse(await health.json());
      rtt.push(now() - started);
      const response = await fetcher(new URL('/v1/debug/asr-connect', url), { method: 'POST',
        headers: { 'x-debug-token': token }, redirect: 'error', signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error('ASR probe failed');
      const asr = AsrMetrics.parse(await response.json());
      const target = await measureTarget(url, image, token, goal, options);
      if (asr.mode !== target.mode || (mode !== undefined && mode !== target.mode)) throw new Error('Model mode changed');
      mode = target.mode;
      connect.push(asr.connectMs); ready.push(asr.readyMs);
      spark.push(target.sparkMs); sam.push(target.samMs); total.push(target.keyframeToTargetMs);
      maskFallbacks += target.samRefined === 0 ? 1 : 0;
    }
    const summary = (values: number[]): TimingSummary => {
      if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('Invalid timing');
      const sorted = [...values].sort((a, b) => a - b);
      return { p50: sorted[Math.ceil(samples * 0.5) - 1]!, p95: sorted[Math.ceil(samples * 0.95) - 1]! };
    };
    return { mode: mode!, samples, maskFallbacks, rttMs: summary(rtt), asrConnectMs: summary(connect), asrReadyMs: summary(ready),
      sparkMs: summary(spark), samMs: summary(sam), keyframeToTargetMs: summary(total) };
  } catch { throw new Error('Regional measurement failed'); }
}
