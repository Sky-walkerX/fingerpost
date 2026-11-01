import { describe, expect, test } from 'vitest';
import { buildFastFood } from '../src/sim/scenes/fastfood.ts';
import { buildTicket } from '../src/sim/scenes/ticket.ts';
import { buildCooktop } from '../src/sim/scenes/cooktop.ts';
import { buildPinPad } from '../src/sim/scenes/pinpad.ts';
import { applyTouch, currentScreen, newRun } from '../src/sim/log.ts';
import type { SimElement } from '../src/sim/model.ts';

const centre = (e: SimElement) => ({ x: e.rect.x + e.rect.w / 2, y: e.rect.y + e.rect.h / 2 });
const tap = (s: ReturnType<typeof newRun>, id: string) => {
  const e = currentScreen(s).elements.find((x) => x.id === id)!;
  return applyTouch(s, { ...centre(e), pointerId: 1, ts: 0 });
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
});

