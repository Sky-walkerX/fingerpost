import type { Box, ScreenType } from '@fingerpost/protocol';
import { tokenSetRatio } from '@fingerpost/gateway/eval-api';

export function iou(a: Box, b: Box): number {
  const w = Math.min(a.u + a.w, b.u + b.w) - Math.max(a.u, b.u);
  const h = Math.min(a.v + a.h, b.v + b.h) - Math.max(a.v, b.v);
  const inter = Math.max(0, w) * Math.max(0, h);
  const union = a.w * a.h + b.w * b.h - inter;
  return union <= 0 ? 0 : inter / union;
}

export const boxOfPolygon = (pts: readonly { u: number; v: number }[]): Box => {
  const us = pts.map((p) => p.u), vs = pts.map((p) => p.v);
  const u = Math.min(...us), v = Math.min(...vs);
  return { u, v, w: Math.max(...us) - u, h: Math.max(...vs) - v };
};

export interface Labeled { label: string; box: Box; }
export interface MatchResult { tp: number; fp: number; fn: number; pairs: Array<[number, number]>; }

/** Greedy one-to-one matching by IoU (≥ 0.5) among pairs whose labels agree (token-set ratio ≥ 0.8). */
export function matchElements(pred: readonly Labeled[], gt: readonly Labeled[], minIou = 0.5, minLabel = 0.8): MatchResult {
  const candidates: Array<{ p: number; g: number; iou: number }> = [];
  pred.forEach((a, p) => gt.forEach((b, g) => {
    const overlap = iou(a.box, b.box);
    if (overlap >= minIou && tokenSetRatio(a.label, b.label) >= minLabel) candidates.push({ p, g, iou: overlap });
  }));
  candidates.sort((x, y) => y.iou - x.iou);
  const usedP = new Set<number>(), usedG = new Set<number>();
  const pairs: Array<[number, number]> = [];
  for (const c of candidates) {
    if (usedP.has(c.p) || usedG.has(c.g)) continue;
    usedP.add(c.p); usedG.add(c.g); pairs.push([c.p, c.g]);
  }
  return { tp: pairs.length, fp: pred.length - pairs.length, fn: gt.length - pairs.length, pairs };
}

/** Nearest-rank percentile; NaN for an empty list. */
export function percentile(xs: readonly number[], p: number): number {
  if (!xs.length) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]!;
}

export const centreInBox = (pts: readonly { u: number; v: number }[], b: Box) => {
  const box = boxOfPolygon(pts);
  const u = box.u + box.w / 2, v = box.v + box.h / 2;
  return u >= b.u && u <= b.u + b.w && v >= b.v && v <= b.v + b.h;
};

/** USD per call at Standard prices (docs/design.md §4.5): Spark $1.25/M in, $4.25/M out; SAM $0.0025 per image. */
export const costUsd = (inTok: number, outTok: number, samImages: number) => (inTok * 1.25 + outTok * 4.25) / 1e6 + samImages * 0.0025;

export const SENSITIVE: ReadonlySet<ScreenType> = new Set(['pin_pad', 'payment_entry']);

export interface ItemResult {
  image: string; latencyMs: number; inputTokens: number; outputTokens: number; samCalls: number;
  match: MatchResult; screenTypeOk: boolean; gtSensitive: boolean; predSensitive: boolean;
  goals: Array<{ goal: string; hit: boolean }>;
}

export interface Summary {
  items: number; precision: number; recall: number; targetHitRate: number; screenTypeAccuracy: number;
  pinPaymentRecall: number; pinPaymentItems: number; latencyP50: number; latencyP95: number; costPerParseUsd: number;
}

export function summarize(r: readonly ItemResult[]): Summary {
  const sum = (f: (x: ItemResult) => number) => r.reduce((acc, x) => acc + f(x), 0);
  const ratio = (num: number, den: number) => (den === 0 ? NaN : num / den);
  const tp = sum((x) => x.match.tp), fp = sum((x) => x.match.fp), fn = sum((x) => x.match.fn);
  const goals = r.flatMap((x) => x.goals);
  const sensitive = r.filter((x) => x.gtSensitive);
  const latencies = r.map((x) => x.latencyMs);
  return {
    items: r.length,
    precision: ratio(tp, tp + fp),
    recall: ratio(tp, tp + fn),
    targetHitRate: ratio(goals.filter((g) => g.hit).length, goals.length),
    screenTypeAccuracy: ratio(r.filter((x) => x.screenTypeOk).length, r.length),
    pinPaymentRecall: ratio(sensitive.filter((x) => x.predSensitive).length, sensitive.length),
    pinPaymentItems: sensitive.length,
    latencyP50: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    costPerParseUsd: ratio(sum((x) => costUsd(x.inputTokens, x.outputTokens, x.samCalls)), r.length),
  };
}

const pct = (x: number) => (Number.isNaN(x) ? 'n/a' : `${(x * 100).toFixed(1)}%`);
export function renderReport(title: string, s: Summary, r: readonly ItemResult[], meta: Record<string, string>): string {
  const head = Object.entries(meta).map(([k, v]) => `- ${k}: ${v}`).join('\n');
  const rows = r.map((x, index) => `| sample-${String(index + 1).padStart(3, '0')} | ${x.match.tp}/${x.match.tp + x.match.fn} | ${x.match.fp} | ${x.screenTypeOk ? 'yes' : 'no'} | ${x.goals.map((g) => (g.hit ? '✓' : '✗')).join(' ') || '–'} | ${x.latencyMs} |`).join('\n');
  return `# ${title}\n\n${head}\n\n| Metric | Value |\n|---|---|\n| Items | ${s.items} |\n| Element precision | ${pct(s.precision)} |\n| Element recall | ${pct(s.recall)} |\n| Target hit rate | ${pct(s.targetHitRate)} |\n| Screen-type accuracy | ${pct(s.screenTypeAccuracy)} |\n| PIN/payment recall (n=${s.pinPaymentItems}) | ${pct(s.pinPaymentRecall)} |\n| Latency p50 / p95 | ${s.latencyP50} / ${s.latencyP95} ms |\n| Cost per parse | $${Number.isNaN(s.costPerParseUsd) ? 'n/a' : s.costPerParseUsd.toFixed(4)} |\n\n| Sample | Found | Extra | Type | Goals | ms |\n|---|---|---|---|---|---|\n${rows}\n\nLatency measures parsing only, not the complete guidance loop. Target hit uses the SAM polygon or the same Spark-box fallback as the gateway. Cost uses planning rates, not measured billing; mock mode makes no paid calls. Source filenames and recognized text are omitted.\n`;
}
