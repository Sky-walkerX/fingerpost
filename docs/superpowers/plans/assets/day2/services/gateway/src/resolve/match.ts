import type { LayoutElement } from '@fingerpost/protocol';
import { normalizeLabel } from '../parse/spark-parse.ts';

const tokens = (s: string) => new Set(normalizeLabel(s).split(' ').filter(Boolean));

/**
 * Token-set ratio in [0,1] (guidance-spec §11 uses it with threshold 0.8): 2·|A∩B| / (|A|+|B|),
 * but a full containment of the shorter set in the longer one scores 1 ("start" vs "start order" → 1).
 */
export function tokenSetRatio(a: string, b: string): number {
  throw new Error('TODO(D2-T5): implement this; the tests describe the behaviour');
}

export type Resolution =
  | { kind: 'match'; element: LayoutElement; score: number }
  | { kind: 'ambiguous'; candidates: LayoutElement[] }
  | { kind: 'none' };

/** Words in a goal that never name a control ("press the start button" → "start"). */
const FILLER = new Set(['press', 'tap', 'touch', 'push', 'click', 'select', 'choose', 'the', 'a', 'an', 'button', 'key', 'please', 'on', 'option', 'दबाएं', 'दबाओ', 'बटन', 'pulsa', 'presiona', 'toca', 'el', 'la', 'botón', 'boton']);
export const goalCore = (goal: string) => { throw new Error('TODO(D2-T5): implement this; the tests describe the behaviour'); };

/**
 * Deterministic first pass before asking Spark: compare the goal core with each tappable element's
 * label, labelLocal and textNorm. Text-role elements are never targets.
 * 1. Exact normalized name matches: one → match, several → ambiguous.
 * 2. Otherwise token-set ratio ≥ 0.8; the best wins unless another is within 0.05 → ambiguous.
 */
export function resolveByText(goal: string, elements: readonly LayoutElement[]): Resolution {
  throw new Error('TODO(D2-T5): implement this; the tests describe the behaviour');
}
