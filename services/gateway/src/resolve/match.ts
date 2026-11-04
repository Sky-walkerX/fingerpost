import type { LayoutElement } from '@fingerpost/protocol';
import { normalizeLabel } from '../parse/spark-parse.ts';

const tokens = (s: string) => new Set(normalizeLabel(s).split(' ').filter(Boolean));

/**
 * Token-set ratio in [0,1] (guidance-spec §11 uses it with threshold 0.8): 2·|A∩B| / (|A|+|B|),
 * but a full containment of the shorter set in the longer one scores 1 ("start" vs "start order" → 1).
 */
export function tokenSetRatio(a: string, b: string): number {
  const left = tokens(a), right = tokens(b);
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter((token) => right.has(token)).length;
  return shared === Math.min(left.size, right.size) ? 1 : 2 * shared / (left.size + right.size);
}

export type Resolution =
  | { kind: 'match'; element: LayoutElement; score: number }
  | { kind: 'ambiguous'; candidates: LayoutElement[] }
  | { kind: 'none' };

/** Words in a goal that never name a control ("press the start button" → "start"). */
const FILLER = new Set(['press', 'tap', 'touch', 'push', 'click', 'select', 'choose', 'the', 'a', 'an', 'button', 'key', 'please', 'on', 'option', 'दबाएं', 'दबाओ', 'बटन', 'pulsa', 'presiona', 'toca', 'el', 'la', 'botón', 'boton',
  // Conversational wrappers ("I wanna press add to order" → "add order").
  'i', 'im', 'want', 'wanna', 'would', 'like', 'to', 'me', 'can', 'could', 'you', 'let', 'lets', 'need', 'gonna', 'it', 'my', 'for', 'just', 'will', 'do', 'of', 'that', 'this', 'with',
  'मुझे', 'है', 'करना', 'quiero', 'por', 'favor']);
export const goalCore = (goal: string) => normalizeLabel(goal).split(' ').filter((word) => word && !FILLER.has(word)).join(' ');
/** A label without filler words and printed numbers ("add to order 6 90" → "add order"): prices never name a control. */
const labelCore = (name: string) => name.split(' ').filter((word) => word && !FILLER.has(word) && !/^\p{N}+$/u.test(word)).join(' ');

/**
 * Deterministic first pass before asking Spark: compare the goal core with each tappable element's
 * label, labelLocal and textNorm. Text-role elements are never targets.
 * 1. Exact normalized name matches: one → match, several → ambiguous.
 * 2. Otherwise token-set ratio ≥ 0.8; the best wins unless another is within 0.05 → ambiguous.
 */
export function resolveByText(goal: string, elements: readonly LayoutElement[]): Resolution {
  const core = goalCore(goal);
  if (!core) return { kind: 'none' };
  const named = elements.filter((element) => element.role !== 'text').map((element) => ({
    element, names: [element.label, element.labelLocal, element.textNorm].filter((name) => name !== undefined).map(normalizeLabel)
      .flatMap((name) => [name, labelCore(name)]).filter(Boolean),
  }));
  const exact = named.filter(({ names }) => names.includes(core));
  if (exact.length > 1) return { kind: 'ambiguous', candidates: exact.map(({ element }) => element) };
  if (exact.length === 1) return { kind: 'match', element: exact[0]!.element, score: 1 };
  const scored = named.map(({ element, names }) => ({ element, score: Math.max(...names.map((name) => tokenSetRatio(core, name))) }))
    .filter(({ score }) => score >= 0.8).sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return { kind: 'none' };
  const close = scored.filter(({ score }) => score >= best.score - 0.05);
  return close.length > 1 ? { kind: 'ambiguous', candidates: close.map(({ element }) => element) }
    : { kind: 'match', ...best };
}
