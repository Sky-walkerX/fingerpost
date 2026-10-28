// Diagnostic inputs to ADR-0003; this does not measure Voice Transcribe or the app's full task flow.
import { readFileSync } from 'node:fs';
import { measureRegion, parseLatencyArguments, type TimingSummary } from './latency-runner.ts';

export async function main(args = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env): Promise<number> {
  if (!env.DEBUG_TOKEN) {
    console.error('DEBUG_TOKEN missing (configure the ignored local environment first)');
    return 2;
  }
  try {
    const { urls, samples } = parseLatencyArguments(args);
    const sample = readFileSync(new URL('../../../evals/datasets/private/day1/latency-sample.jpg', import.meta.url));
    const results = [];
    for (const url of urls) results.push({ origin: url.origin,
      measurements: await measureRegion(url, sample, env.DEBUG_TOKEN, samples) });
    const timing = (value: TimingSummary) => `p50 ${value.p50.toFixed(0)} ms  p95 ${value.p95.toFixed(0)} ms`;
    for (const { origin, measurements: result } of results) {
      console.log(`${origin} (${result.samples} samples)\n  health RTT: ${timing(result.rttMs)}\n` +
        `  gateway Spark: ${timing(result.sparkMs)}\n  gateway SAM: ${timing(result.samMs)}\n` +
        `  parse-and-fixed-box-segmentation round trip: ${timing(result.parseAndSegmentRoundTripMs)}`);
    }
    console.log('ADR-0003 remains pending: these diagnostics do not measure Voice Transcribe connect or the complete keyframe-to-target flow. Use latency:region for the controlled binary target benchmark.');
    return 0;
  } catch {
    console.error('Latency measurement failed. Check URLs, the private 1024x576 JPEG sample, debug token and service availability locally.');
    return 1;
  }
}

if (import.meta.main) process.exitCode = await main();
