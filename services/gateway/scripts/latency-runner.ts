import { LIMITS } from '@fingerpost/protocol';
import { jpegSize } from '../src/debug/jpeg.ts';
import { LatencyMetrics } from '../src/debug/latency-metrics.ts';

export interface LatencyArguments { urls: URL[]; samples: number; }
export interface TimingSummary { p50: number; p95: number; }
export interface RegionMeasurements {
  samples: number;
  rttMs: TimingSummary;
  sparkMs: TimingSummary;
  samMs: TimingSummary;
  parseAndSegmentRoundTripMs: TimingSummary;
}

export function parseLatencyArguments(args: string[]): LatencyArguments {
  const invalid = () => new Error('Invalid latency arguments');
  const urls: URL[] = [];
  let samples = 20, seenCount = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!;
    if (argument === '--n') {
      const count = args[++index];
      if (seenCount || !count || !/^\d+$/.test(count)) throw invalid();
      samples = Number(count);
      if (!Number.isSafeInteger(samples) || samples < 1 || samples > 20) throw invalid();
      seenCount = true;
      continue;
    }
    let url: URL;
    try { url = new URL(argument); } catch { throw invalid(); }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
        url.username || url.password || url.search || url.hash || url.pathname !== '/') throw invalid();
    urls.push(url);
  }
  if (urls.length === 0) throw invalid();
  return { urls, samples };
}

export async function measureRegion(
  url: URL, sample: Uint8Array, token: string, samples: number,
  fetcher: typeof fetch = fetch,
): Promise<RegionMeasurements> {
  parseLatencyArguments([url.href, '--n', String(samples)]);
  const size = jpegSize(sample);
  if (size.width !== 1024 || size.height !== 576 || sample.length > LIMITS.keyframeBytes)
    throw new Error('Latency sample must be a 1024x576 JPEG within the keyframe size limit');
  if (token.length < 16) throw new Error('Debug token is missing or invalid');
  const rtt: number[] = [], spark: number[] = [], sam: number[] = [], roundTrip: number[] = [];
  for (let index = 0; index < samples; index++) {
    const healthStart = performance.now();
    const health = await fetcher(new URL('/healthz', url), { redirect: 'error', signal: AbortSignal.timeout(60_000) });
    if (!health.ok) throw new Error('Regional health check failed');
    await health.arrayBuffer();
    rtt.push(performance.now() - healthStart);
    const started = performance.now();
    const response = await fetcher(new URL('/v1/debug/latency', url), {
      method: 'POST', headers: { 'content-type': 'image/jpeg', 'x-debug-token': token },
      body: Buffer.from(sample), redirect: 'error', signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error('Regional model measurement failed');
    let body: unknown;
    try { body = await response.json(); } catch { throw new Error('Invalid regional latency metrics'); }
    const parsed = LatencyMetrics.safeParse(body);
    if (!parsed.success) throw new Error('Invalid regional latency metrics');
    roundTrip.push(performance.now() - started);
    spark.push(parsed.data.sparkMs);
    sam.push(parsed.data.samMs);
  }
  const summary = (values: number[]): TimingSummary => {
    const sorted = [...values].sort((a, b) => a - b);
    return { p50: sorted[Math.ceil(sorted.length * 0.5) - 1]!, p95: sorted[Math.ceil(sorted.length * 0.95) - 1]! };
  };
  return { samples, rttMs: summary(rtt), sparkMs: summary(spark), samMs: summary(sam),
    parseAndSegmentRoundTripMs: summary(roundTrip) };
}
