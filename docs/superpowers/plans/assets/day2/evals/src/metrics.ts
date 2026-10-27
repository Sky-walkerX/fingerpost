import type { Box, ScreenType } from '@fingerpost/protocol';
import { tokenSetRatio } from '@fingerpost/gateway/eval-api';

export function iou(a: Box, b: Box): number {
  throw new Error('TODO(D2-T8): implement this; the tests describe the behaviour');
}

export const boxOfPolygon = (pts: readonly { u: number; v: number }[]): Box => { throw new Error('TODO(D2-T8): implement this; the tests describe the behaviour'); };

export interface Labeled { label: string; box: Box; }
export interface MatchResult { tp: number; fp: number; fn: number; pairs: Array<[number, number]>; }

/** Greedy one-to-one matching by IoU (≥ 0.5) among pairs whose labels agree (token-set ratio ≥ 0.8). */
export function matchElements(pred: readonly Labeled[], gt: readonly Labeled[], minIou = 0.5, minLabel = 0.8): MatchResult {
  throw new Error('TODO(D2-T8): implement this; the tests describe the behaviour');
}

/** Nearest-rank percentile; NaN for an empty list. */
export function percentile(xs: readonly number[], p: number): number {
  throw new Error('TODO(D2-T8): implement this; the tests describe the behaviour');
}

export const centreInBox = (pts: readonly { u: number; v: number }[], b: Box) => { throw new Error('TODO(D2-T8): implement this; the tests describe the behaviour'); };

/** USD per call at Standard prices (docs/design.md §4.5): Spark $1.25/M in, $4.25/M out; SAM $0.0025 per image. */
export const costUsd = (inTok: number, outTok: number, samImages: number) => { throw new Error('TODO(D2-T8): implement this; the tests describe the behaviour'); };

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
  throw new Error('TODO(D2-T8): implement this; the tests describe the behaviour');
}

const pct = (x: number) => (Number.isNaN(x) ? 'n/a' : `${(x * 100).toFixed(1)}%`);
export function renderReport(title: string, s: Summary, r: readonly ItemResult[], meta: Record<string, string>): string {
  const head = Object.entries(meta).map(([k, v]) => `- ${k}: ${v}`).join('\n');
  const rows = r.map((x) => `| ${x.image} | ${x.match.tp}/${x.match.tp + x.match.fn} | ${x.match.fp} | ${x.screenTypeOk ? 'yes' : 'no'} | ${x.goals.map((g) => (g.hit ? '✓' : '✗')).join(' ') || '–'} | ${x.latencyMs} |`).join('\n');
  return `# ${title}\n\n${head}\n\n| Metric | Value |\n|---|---|\n| Items | ${s.items} |\n| Element precision | ${pct(s.precision)} |\n| Element recall | ${pct(s.recall)} |\n| Target hit rate | ${pct(s.targetHitRate)} |\n| Screen-type accuracy | ${pct(s.screenTypeAccuracy)} |\n| PIN/payment recall (n=${s.pinPaymentItems}) | ${pct(s.pinPaymentRecall)} |\n| Latency p50 / p95 | ${s.latencyP50} / ${s.latencyP95} ms |\n| Cost per parse | $${Number.isNaN(s.costPerParseUsd) ? 'n/a' : s.costPerParseUsd.toFixed(4)} |\n\n| Image | Found | Extra | Type | Goals | ms |\n|---|---|---|---|---|---|\n${rows}\n`;
}
