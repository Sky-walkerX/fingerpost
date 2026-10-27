import type { LayoutElement } from '@fingerpost/protocol';

/** "top left" … "bottom right", "middle" for the centre cell. Uses the polygon's vertex mean. */
export function describePosition(polygon: readonly { u: number; v: number }[]): string {
  throw new Error('TODO(D2-T5): implement this; the tests describe the behaviour');
}

/** "Timer, Power and Start" — tappable labels only, at most `max`. */
export function listLabels(elements: readonly LayoutElement[], max = 5): string {
  throw new Error('TODO(D2-T5): implement this; the tests describe the behaviour');
}
