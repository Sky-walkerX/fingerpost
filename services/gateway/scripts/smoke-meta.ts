// Live smoke test against the Meta Model API (Day 1, Task 5). Costs real credits (~$0.01 per image).
// Usage (repo root): set -a; source .env; set +a; pnpm --filter @fingerpost/gateway smoke
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createMetaClient } from '../src/models/meta-client.ts';
import { liveModels } from '../src/models/port.ts';

const key = process.env.META_API_KEY;
if (!key) { console.error('META_API_KEY missing (source .env first)'); process.exit(2); }
const dir = new URL('../../../evals/datasets/day1/', import.meta.url);
const out = new URL('../../../docs/evals/', import.meta.url);
const images = readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).sort();
if (images.length === 0) { console.error(`no .jpg files in ${dir.pathname}`); process.exit(2); }

/** JPEG width/height from the SOF0/SOF2 marker (no image library needed). */
function jpegSize(b: Uint8Array): { width: number; height: number } {
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1]!, len = (b[i + 2]! << 8) | b[i + 3]!;
    if (m === 0xc0 || m === 0xc2) return { height: (b[i + 5]! << 8) | b[i + 6]!, width: (b[i + 7]! << 8) | b[i + 8]! };
    i += 2 + len;
  }
  throw new Error('no SOF marker');
}
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1)] ?? NaN;

const models = liveModels(createMetaClient(key));
const rows: string[] = []; const spark: number[] = [], samBox: number[] = [], samText: number[] = []; let inTok = 0, outTok = 0;
mkdirSync(new URL('day1/', out), { recursive: true });
for (const name of images) {
  const bytes = new Uint8Array(readFileSync(new URL(name, dir)));
  const { width, height } = jpegSize(bytes);
  const p = await models.parseScreen({ bytes, mime: 'image/jpeg' }, { locale: 'en' });
  spark.push(p.latencyMs); inTok += p.usage.inputTokens; outTok += p.usage.outputTokens;
  const btn = p.layout.elements.find((e) => e.role !== 'text');
  let boxNote = 'no button found';
  let poly = null;
  if (btn) {
    const xs = btn.polygon.map((q) => q.u * width), ys = btn.polygon.map((q) => q.v * height);
    const s = await models.segmentByBox({ bytes, width, height }, { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) });
    samBox.push(s.latencyMs); poly = s.polygon; boxNote = `${btn.label} → ${s.polygon ? `${s.polygon.length} pts` : 'no mask'}`;
  }
  const scr = await models.segmentByText({ bytes, width, height }, 'touchscreen display');
  samText.push(scr.latencyMs);
  rows.push(`| ${name} | ${p.layout.elements.length} | ${p.layout.screenType} | ${p.latencyMs} | ${boxNote} | ${scr.polygon ? 'yes' : 'no'} | ${p.usage.inputTokens}/${p.usage.outputTokens} |`);
  // Overlay: element boxes (blue) and the SAM target polygon (green) on the photo, viewable in any browser.
  const toPts = (pts: { u: number; v: number }[]) => pts.map((q) => `${(q.u * width).toFixed(1)},${(q.v * height).toFixed(1)}`).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><image href="data:image/jpeg;base64,${Buffer.from(bytes).toString('base64')}" width="${width}" height="${height}"/>` +
    p.layout.elements.map((e) => `<polygon points="${toPts(e.polygon)}" fill="none" stroke="#2563eb" stroke-width="3"/>`).join('') +
    (poly ? `<polygon points="${toPts(poly)}" fill="rgba(22,163,74,.35)" stroke="#16a34a" stroke-width="4"/>` : '') + '</svg>';
  writeFileSync(new URL(`day1/${name.replace(/\.jpe?g$/i, '')}.svg`, out), svg);
  process.stdout.write('.');
}
const cost = (inTok * 1.25 + outTok * 4.25) / 1e6 + (samBox.length + samText.length) * 0.0025;
const md = `# Day 1 live smoke (${new Date().toISOString()})\n\n| Image | Elements | Screen type | Spark ms | SAM box target | SAM screen | Tokens in/out |\n|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\n` +
  `| Call | p50 ms | p95 ms |\n|---|---|---|\n| Spark parse | ${pct(spark, 50)} | ${pct(spark, 95)} |\n| SAM box | ${pct(samBox, 50)} | ${pct(samBox, 95)} |\n| SAM text | ${pct(samText, 50)} | ${pct(samText, 95)} |\n\n` +
  `Average input tokens per parse: ${Math.round(inTok / images.length)}. Total cost: $${cost.toFixed(4)} (~$${(cost / images.length).toFixed(4)} per image).\n\nOverlays: docs/evals/day1/*.svg (blue = Spark boxes, green = SAM target).\n`;
writeFileSync(new URL('day1-smoke.md', out), md);
console.log(`\nwrote docs/evals/day1-smoke.md`);
