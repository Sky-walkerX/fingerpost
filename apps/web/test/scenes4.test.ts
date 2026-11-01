import { describe, expect, test } from 'vitest';
import { buildFastFood } from '../src/sim/scenes/fastfood.ts';
import { buildTicket } from '../src/sim/scenes/ticket.ts';
import { buildCooktop } from '../src/sim/scenes/cooktop.ts';
import { buildPinPad } from '../src/sim/scenes/pinpad.ts';
import { buildCheckin } from '../src/sim/scenes/checkin.ts';
import { buildAdversarial } from '../src/sim/scenes/adversarial.ts';
import { applyTouch, currentScreen, newRun } from '../src/sim/log.ts';
import { CANVAS, type SimElement, type SimScene } from '../src/sim/model.ts';

const centre = (e: SimElement) => ({ x: e.rect.x + e.rect.w / 2, y: e.rect.y + e.rect.h / 2 });
const tap = (s: ReturnType<typeof newRun>, id: string) => {
  const e = currentScreen(s).elements.find((x) => x.id === id)!;
  return applyTouch(s, { ...centre(e), pointerId: 1, ts: 0 });
};
const overlaps = (a: SimElement, b: SimElement) =>
  a.rect.x < b.rect.x + b.rect.w &&
  b.rect.x < a.rect.x + a.rect.w &&
  a.rect.y < b.rect.y + b.rect.h &&
  b.rect.y < a.rect.y + a.rect.h;

const sane = (build: (seed: number) => SimScene) => {
  for (let seed = 1; seed <= 50; seed++) {
    for (const s of build(seed).screens) {
      for (const e of s.elements) {
        expect(e.rect.x + e.rect.w).toBeLessThanOrEqual(CANVAS.w);
        expect(e.rect.y + e.rect.h).toBeLessThanOrEqual(CANVAS.h);
        expect(Math.min(e.rect.x, e.rect.y)).toBeGreaterThanOrEqual(0);
      }
      for (let i = 0; i < s.elements.length; i++) {
        for (let j = i + 1; j < s.elements.length; j++) {
          expect(overlaps(s.elements[i]!, s.elements[j]!)).toBe(false);
        }
      }
      for (const target of Object.values(s.next)) {
        expect(build(seed).screens.some((x) => x.id === target)).toBe(true);
      }
    }
  }
};

describe('scenes4 fastfood PIN step', () => {
  test('fastfood pay leads to pin then done', () => {
    const s = newRun('fastfood-pin-test', buildFastFood(1));
    for (const id of ['start-order', 'drinks', 'medium', 'pay-card']) tap(s, id);
    expect(s.screenId).toBe('pin');
    expect(currentScreen(s).elements.some((e) => e.role === 'key')).toBe(true);
    tap(s, 'key-ok');
    expect(s.screenId).toBe('done');
  });

  test("every scene's next targets exist", () => {
    const builders = [
      (seed: number) => buildFastFood(seed),
      (seed: number) => buildTicket(seed),
      (seed: number) => buildCooktop(seed),
      (seed: number) => buildPinPad(seed, 'scrambled'),
      (seed: number) => buildCheckin(seed),
      (seed: number) => buildAdversarial(seed),
    ];
    for (const build of builders) {
      for (let seed = 1; seed <= 20; seed++) {
        const scene = build(seed);
        const screenIds = new Set(scene.screens.map((sc) => sc.id));
        for (const screen of scene.screens) {
          for (const target of Object.values(screen.next)) {
            expect(screenIds.has(target)).toBe(true);
          }
        }
      }
    }
  });

  test('checkin has 4 screens ending in a confirm-role print button', () => {
    const scene = buildCheckin(1);
    expect(scene.screens).toHaveLength(4);
    const screenIds = scene.screens.map((s) => s.id);
    expect(screenIds).toEqual(['lang', 'booking', 'seat', 'confirm']);
    const confirmScreen = scene.screens.find((s) => s.id === 'confirm')!;
    expect(confirmScreen.elements.some((e) => e.role === 'confirm')).toBe(true);
  });

  test('checkin layout is sane for seeds 1–50', () => sane(buildCheckin));

  test('adversarial has near-duplicate labels, an icon-only button, low contrast and a Hindi screen', () => {
    const scene = buildAdversarial(1);
    const allElements = scene.screens.flatMap((s) => s.elements);

    // Near-duplicate labels (e.g. "Start" and "Quick start")
    const labels = allElements.map((e) => e.label);
    expect(labels).toContain('Start');
    expect(labels).toContain('Quick start');

    // Icon-only button (role icon, no text label)
    const iconOnly = allElements.find((e) => e.role === 'icon' && e.label === '');
    expect(iconOnly).toBeDefined();

    // Low-contrast screen
    const lowContrastScreen = scene.screens.find(
      (s) => s.id === 'low-contrast' || s.title.toLowerCase().includes('low contrast')
    );
    expect(lowContrastScreen).toBeDefined();
    expect(lowContrastScreen!.elements.length).toBeGreaterThan(0);

    // Hindi-language screen
    const hindiScreen = scene.screens.find(
      (s) =>
        s.id === 'hindi' ||
        /[\u0900-\u097F]/.test(s.title) ||
        s.elements.some((e) => /[\u0900-\u097F]/.test(e.label))
    );
    expect(hindiScreen).toBeDefined();
    expect(hindiScreen!.elements.some((e) => /[\u0900-\u097F]/.test(e.label))).toBe(true);
  });

  test('adversarial layout is sane for seeds 1–50', () => sane(buildAdversarial));
});
