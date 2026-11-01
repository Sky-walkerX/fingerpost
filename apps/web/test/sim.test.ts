import { describe, expect, test } from 'vitest';
import { mulberry32 } from '../src/sim/rng.ts';
import { buildFastFood } from '../src/sim/scenes/fastfood.ts';
import { buildPinPad, pinDigits } from '../src/sim/scenes/pinpad.ts';
import { hitTest } from '../src/sim/hit.ts';
import { applyTouch, currentScreen, labelsFor, newRun } from '../src/sim/log.ts';
import { CANVAS, type SimElement } from '../src/sim/model.ts';

const centre = (e: SimElement) => ({ x: e.rect.x + e.rect.w / 2, y: e.rect.y + e.rect.h / 2 });
const tap = (s: ReturnType<typeof newRun>, id: string, pointerId = 1, ts = 0) => {
  const e = currentScreen(s).elements.find((x) => x.id === id)!;
  return applyTouch(s, { ...centre(e), pointerId, ts });
};
const overlaps = (a: SimElement, b: SimElement) => a.rect.x < b.rect.x + b.rect.w && b.rect.x < a.rect.x + a.rect.w && a.rect.y < b.rect.y + b.rect.h && b.rect.y < a.rect.y + a.rect.h;

test('mulberry32 is deterministic and in [0,1)', () => {
  const a = mulberry32(7), b = mulberry32(7);
  const xs = Array.from({ length: 100 }, () => a());
  expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
  expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
});

describe('fast-food scene', () => {
  test('same seed → identical layout; different seed → different', () => {
    expect(buildFastFood(1)).toEqual(buildFastFood(1));
    expect(buildFastFood(1)).not.toEqual(buildFastFood(2));
  });
  test('for seeds 1–50 no elements overlap and all stay inside the canvas', () => {
    for (let seed = 1; seed <= 50; seed++) for (const s of buildFastFood(seed).screens) {
      for (const e of s.elements) {
        expect(e.rect.x).toBeGreaterThanOrEqual(0); expect(e.rect.y).toBeGreaterThanOrEqual(0);
        expect(e.rect.x + e.rect.w).toBeLessThanOrEqual(CANVAS.w); expect(e.rect.y + e.rect.h).toBeLessThanOrEqual(CANVAS.h);
      }
      for (let i = 0; i < s.elements.length; i++) for (let j = i + 1; j < s.elements.length; j++) expect(overlaps(s.elements[i]!, s.elements[j]!)).toBe(false);
    }
  });
  test('pay screen has exactly one role=pay element', () => {
    const pay = buildFastFood(3).screens.find((s) => s.id === 'pay')!;
    expect(pay.elements.filter((e) => e.role === 'pay')).toHaveLength(1);
  });
  test('the happy path home → menu → drink-size → pay → pin → done logs one event per tap', () => {
    const s = newRun('run-1', buildFastFood(1));
    for (const id of ['start-order', 'drinks', 'medium', 'pay-card', 'key-ok']) tap(s, id);
    expect(s.screenId).toBe('done');
    expect(s.events.map((e) => [e.screenId, e.elementId])).toEqual([['home', 'start-order'], ['menu', 'drinks'], ['drink-size', 'medium'], ['pay', 'pay-card'], ['pin', 'key-ok']]);
  });
});

describe('touch logging', () => {
  test('a tap on a gap is logged with elementId null and does not navigate', () => {
    const s = newRun('r', buildFastFood(1));
    const ev = applyTouch(s, { x: 5, y: 795, pointerId: 1, ts: 1 });
    expect(ev.elementId).toBeNull();
    expect(s.screenId).toBe('home');
    expect(s.events).toHaveLength(1);
  });
  test('text elements are not tappable', () => {
    const home = buildFastFood(1).screens[0]!;
    expect(hitTest(home.elements, centre(home.elements.find((e) => e.id === 'welcome')!).x, centre(home.elements.find((e) => e.id === 'welcome')!).y)).toBeNull();
  });
  test('rapid double tap logs two events (second one lands on the next screen)', () => {
    const s = newRun('r', buildFastFood(1));
    tap(s, 'start-order', 1, 100);
    applyTouch(s, { ...centre(buildFastFood(1).screens[0]!.elements[1]!), pointerId: 1, ts: 140 });
    expect(s.events).toHaveLength(2);
    expect(s.events[1]!.screenId).toBe('menu');
  });
  test('a second pointer of a multi-touch is logged too', () => {
    const s = newRun('r', buildPinPad(1, 'phone'));
    tap(s, 'key-5', 1, 10); tap(s, 'key-9', 2, 11);
    expect(s.events.map((e) => [e.pointerId, e.elementId])).toEqual([[1, 'key-5'], [2, 'key-9']]);
  });
  test('u,v are canvas-normalized and clamped', () => {
    const ev = applyTouch(newRun('r', buildFastFood(1)), { x: 1400, y: -10, pointerId: 1, ts: 1 });
    expect([ev.u, ev.v]).toEqual([1, 0]);
  });
});

describe('PIN pad', () => {
  test('phone and calculator layouts put 1 and 7 top-left respectively', () => {
    expect(pinDigits('phone', 1).slice(0, 3)).toEqual(['1', '2', '3']);
    expect(pinDigits('calculator', 1).slice(0, 3)).toEqual(['7', '8', '9']);
  });
  test('scrambled is a permutation of 0–9, seeded, and differs from the phone layout for seed 1', () => {
    const s = pinDigits('scrambled', 1);
    expect([...s].sort()).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(pinDigits('scrambled', 1)).toEqual(s);
    expect(s).not.toEqual(pinDigits('phone', 1));
  });
  test('has 10 keys, Clear, OK (confirm) and an "Enter PIN" title', () => {
    const els = buildPinPad(4, 'scrambled').screens[0]!.elements;
    expect(els.filter((e) => e.role === 'key')).toHaveLength(10);
    expect(els.find((e) => e.id === 'key-ok')?.role).toBe('confirm');
    expect(els.find((e) => e.role === 'text')?.label).toBe('Enter PIN');
  });
});

test('labelsFor returns u,v,w,h within [0,1] for every element', () => {
  for (const s of [...buildFastFood(9).screens, ...buildPinPad(9, 'scrambled').screens]) for (const l of labelsFor(s)) {
    for (const n of [l.u, l.v, l.w, l.h]) { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(1); }
    expect(l.u + l.w).toBeLessThanOrEqual(1); expect(l.v + l.h).toBeLessThanOrEqual(1);
  }
});
