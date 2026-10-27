import type { SimElement, SimScene } from '../model.ts';

const k = (id: string, label: string, role: SimElement['role'], x: number, w = 150): SimElement => ({ id, label, role, rect: { x, y: 520, w, h: 150 } });

/**
 * Induction cooktop touch strip: flat black glass, icon keys in one row, a two-digit display.
 * No jitter: real appliance panels don't move. Seed only picks the display reading.
 */
export function buildCooktop(seed: number): SimScene {
  const level = String(seed % 10);
  const elements: SimElement[] = [
    { id: 'display', label: level, role: 'text', rect: { x: 560, y: 180, w: 160, h: 140 } },
    k('power', 'Power', 'icon', 60), k('lock', 'Lock', 'icon', 240), k('minus', 'Minus', 'icon', 420),
    k('plus', 'Plus', 'icon', 710), k('timer', 'Timer', 'icon', 890), k('boil', 'Boil', 'button', 1070),
  ];
  return { id: 'cooktop', seed, start: 'panel', screens: [{ id: 'panel', title: 'Cooktop', elements, next: {} }] };
}
