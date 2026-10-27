import { mulberry32 } from '../rng.ts';
import type { SimElement, SimScene } from '../model.ts';

export type PinLayout = 'phone' | 'calculator' | 'scrambled';
const PHONE = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const CALC = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];

/** Digit labels for the 10 key slots: 9 grid slots in reading order, then the slot between Clear and OK. */
export function pinDigits(layout: PinLayout, seed: number): string[] {
  if (layout === 'phone') return [...PHONE, '0'];
  if (layout === 'calculator') return [...CALC, '0'];
  const d = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const rnd = mulberry32(seed);
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [d[i], d[j]] = [d[j]!, d[i]!]; }
  return d;
}

export function buildPinPad(seed: number, layout: PinLayout): SimScene {
  const digits = pinDigits(layout, seed);
  const key = 150, gap = 24, x0 = (1280 - (3 * key + 2 * gap)) / 2, y0 = 150;
  const slot = (i: number) => ({ x: x0 + (i % 3) * (key + gap), y: y0 + Math.floor(i / 3) * (key * 0.8 + gap), w: key, h: key * 0.8 });
  const elements: SimElement[] = [
    { id: 'title', label: 'Enter PIN', role: 'text', rect: { x: 440, y: 30, w: 400, h: 90 } },
    ...digits.slice(0, 9).map((d, i) => ({ id: `key-${d}`, label: d, role: 'key' as const, rect: slot(i) })),
    { id: 'key-clear', label: 'Clear', role: 'button', rect: slot(9) },
    { id: `key-${digits[9]}`, label: digits[9]!, role: 'key', rect: slot(10) },
    { id: 'key-ok', label: 'OK', role: 'confirm', rect: slot(11) },
  ];
  return { id: 'pinpad', seed, start: 'pin', screens: [{ id: 'pin', title: 'Enter PIN', elements, next: {} }] };
}
