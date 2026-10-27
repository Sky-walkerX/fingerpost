import { CANVAS, type Rect, type SimElement } from './model.ts';

/** Shift a whole screen by ±4% of the canvas, then each element by ±1%, staying inside the canvas. */
export function jitter(elements: SimElement[], rnd: () => number): SimElement[] {
  const gx = (rnd() * 2 - 1) * 0.04 * CANVAS.w, gy = (rnd() * 2 - 1) * 0.04 * CANVAS.h;
  return elements.map((e) => {
    const dx = gx + (rnd() * 2 - 1) * 0.01 * CANVAS.w, dy = gy + (rnd() * 2 - 1) * 0.01 * CANVAS.h;
    const r: Rect = { ...e.rect, x: Math.round(Math.min(CANVAS.w - e.rect.w, Math.max(0, e.rect.x + dx))), y: Math.round(Math.min(CANVAS.h - e.rect.h, Math.max(0, e.rect.y + dy))) };
    return { ...e, rect: r };
  });
}
