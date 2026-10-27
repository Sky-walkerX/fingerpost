// ADR 0003 measurement from this machine (India). Usage:
// pnpm --filter @fingerpost/gateway latency <urlA> <urlB> [--n 20]   (env DEBUG_TOKEN must match the deployed services)
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2).filter((a) => a !== '--');
const nIdx = args.indexOf('--n');
const n = nIdx >= 0 ? Number(args[nIdx + 1]) : 20;
const urls = args.filter((a, i) => !a.startsWith('--') && (nIdx < 0 || i !== nIdx + 1));
const token = process.env.DEBUG_TOKEN;
if (urls.length === 0 || !token) { console.error('usage: latency <url> [<url>…] [--n 20] with DEBUG_TOKEN set'); process.exit(2); }
const sample = readFileSync(new URL('../test/fixtures/latency-sample.jpg', import.meta.url));
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1)]!;

for (const url of urls) {
  const rtt: number[] = [], spark: number[] = [], sam: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now(); await fetch(new URL('/healthz', url)); rtt.push(performance.now() - t0);
    const r = await fetch(new URL('/v1/debug/latency', url), { method: 'POST', headers: { 'content-type': 'image/jpeg', 'x-debug-token': token }, body: sample });
    const j = (await r.json()) as { sparkMs: number; samMs: number };
    spark.push(j.sparkMs + rtt.at(-1)!); sam.push(j.samMs + rtt.at(-1)!);
  }
  console.log(`${url}\n  rtt p50 ${pct(rtt, 50).toFixed(0)} ms  p95 ${pct(rtt, 95).toFixed(0)} ms\n  rtt+spark p50 ${pct(spark, 50).toFixed(0)} p95 ${pct(spark, 95).toFixed(0)}\n  rtt+sam   p50 ${pct(sam, 50).toFixed(0)} p95 ${pct(sam, 95).toFixed(0)}`);
}
