import { Easing, interpolate } from 'remotion';
import { ease } from '../tokens.ts';

export const wipeEase = Easing.bezier(...ease.wipe);
export const outExpo = Easing.bezier(0.16, 1, 0.3, 1);

/** 0→1 over `frames` starting at `start`, clamped, with an easing. */
export function progress(frame: number, start: number, frames: number, easing = outExpo): number {
  return interpolate(frame, [start, start + frames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });
}

/** The house text entrance: rise 30 px and sharpen from a blur over 14 frames. */
export function rise(frame: number, start: number) {
  const p = progress(frame, start, 14);
  return { opacity: p, transform: `translateY(${(1 - p) * 30}px)`, filter: `blur(${(1 - p) * 10}px)` };
}
