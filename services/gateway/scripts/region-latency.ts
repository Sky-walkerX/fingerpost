import { readFileSync } from 'node:fs';
import { parseLatencyArguments, type TimingSummary } from './latency-runner.ts';
import { measureFullRegion, type FullRegionMeasurements } from './region-runner.ts';

export async function main(args = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env): Promise<number> {
  if (!env.DEBUG_TOKEN || !env.LATENCY_GOAL) {
    console.error('DEBUG_TOKEN and LATENCY_GOAL are required in the private local environment.');
    return 2;
  }
  try {
    const { urls, samples } = parseLatencyArguments(args);
    if (urls.length !== 2 || urls[0]!.origin === urls[1]!.origin) throw new Error('Two distinct regions required');
    const image = readFileSync(new URL('../../../evals/datasets/private/day1/latency-sample.jpg', import.meta.url));
    const results: { origin: string; measurements: FullRegionMeasurements }[] = [];
    for (const url of urls) results.push({ origin: url.origin,
      measurements: await measureFullRegion(url, image, env.DEBUG_TOKEN, env.LATENCY_GOAL, samples) });
    if (results.some(({ measurements: value }) => value.samples !== samples || value.mode !== results[0]!.measurements.mode))
      throw new Error('Inconsistent comparison');
    const timing = (value: TimingSummary) => `p50 ${value.p50.toFixed(1)} ms  p95 ${value.p95.toFixed(1)} ms`;
    // Buffer the full comparison until every requested sample in both regions has succeeded.
    for (const { origin, measurements: value } of results) {
      console.log(`${origin} (${value.mode}; ${value.samples} samples)\n` +
        `  health RTT: ${timing(value.rttMs)}\n  gateway ASR upgrade: ${timing(value.asrConnectMs)}\n` +
        `  gateway ASR accepted handshake: ${timing(value.asrReadyMs)}\n` +
        `  gateway Spark: ${timing(value.sparkMs)}\n  gateway SAM: ${timing(value.samMs)}\n` +
        `  binary keyframe-to-target: ${timing(value.keyframeToTargetMs)}\n  SAM mask fallbacks: ${value.maskFallbacks}`);
    }
    if (samples === 20 && results.every(({ measurements: value }) => value.mode === 'live')) {
      const [first, second] = results;
      if (first!.measurements.keyframeToTargetMs.p50 === second!.measurements.keyframeToTargetMs.p50)
        console.log('Equal measured p50 totals; no unique latency winner.');
      else {
        const best = first!.measurements.keyframeToTargetMs.p50 < second!.measurements.keyframeToTargetMs.p50 ? first! : second!;
        console.log(`Lowest measured keyframe-to-target p50: ${best.origin}`);
      }
    } else console.log('Diagnostic only: region ranking requires 20 live samples in both regions.');
    console.log('ADR-0003 remains proposed until these measurements, matching deployment revisions and live quality review are recorded.');
    return 0;
  } catch {
    console.error('Regional measurement failed. Check the private sample, exact control label, debug token and service availability locally.');
    return 1;
  }
}

if (import.meta.main) process.exitCode = await main();
