import type { SimElement } from './model.ts';
/** Topmost (last-drawn) element containing the point; rect edges are inclusive on the left/top, exclusive on the right/bottom. Text is not tappable. */
export function hitTest(elements: readonly SimElement[], x: number, y: number): SimElement | null {
  throw new Error('TODO(D1-T6): implement this; the tests describe the behaviour');
}
