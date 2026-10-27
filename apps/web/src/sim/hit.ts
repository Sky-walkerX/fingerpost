import type { SimElement } from './model.ts';
/** Topmost (last-drawn) element containing the point; rect edges are inclusive on the left/top, exclusive on the right/bottom. Text is not tappable. */
export function hitTest(elements: readonly SimElement[], x: number, y: number): SimElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i]!;
    const { rect } = element;
    if (element.role !== 'text' && x >= rect.x && x < rect.x + rect.w
        && y >= rect.y && y < rect.y + rect.h) return element;
  }
  return null;
}
