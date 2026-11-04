import { describe, expect, test } from 'vitest';
import { cartTotal, displayedTotal, newOrder, press, view, type KioskState } from '../src/kiosk/order.ts';

const run = (actions: string[], s: KioskState = newOrder()) => actions.reduce(press, s);
const labels = (s: KioskState) => {
  const v = view(s);
  return new Set([v.title, ...(v.subtitle ? [v.subtitle] : []), ...v.texts, ...v.buttons.map((b) => b.label)]);
};
const jaccard = (a: Set<string>, b: Set<string>) => {
  const inter = [...a].filter((x) => b.has(x)).length;
  return inter / new Set([...a, ...b]).size;
};
const MEDIUM_COLA = ['start', 'tab:drinks', 'item:cola', 'size:medium', 'review', 'pay', 'pay:card', 'card-read'];

describe('kiosk order flow', () => {
  test('a medium cola order reaches the PIN pad, then approval', () => {
    const atPin = run(MEDIUM_COLA);
    expect(atPin.screen).toBe('pin');
    expect(atPin.cart).toEqual([{ itemId: 'cola', size: 'medium', qty: 1, unit: 240 }]);
    const done = run(['key:1', 'key:2', 'key:3', 'key:4', 'enter', 'processed'], atPin);
    expect(done.screen).toBe('approved');
    expect(done.cart).toEqual([]);
  });

  test('every press on the demo path changes most of the visible labels', () => {
    let s = newOrder();
    for (const a of [...MEDIUM_COLA, 'key:1', 'key:2', 'key:3', 'key:4', 'enter', 'processed']) {
      const next = press(s, a);
      if (!a.startsWith('key:')) expect(jaccard(labels(s), labels(next)), `after ${a}`).toBeLessThan(0.7);
      s = next;
    }
  });

  test('unsized items add from their own page and return to the menu', () => {
    const s = run(['start', 'item:classic', 'add']);
    expect(s.screen).toBe('menu');
    expect(s.cart).toEqual([{ itemId: 'classic', size: null, qty: 1, unit: 650 }]);
    expect(view(s).notice).toBe('Added Classic Burger');
  });

  test('review is disabled for an empty order and cancel clears it', () => {
    expect(view(run(['start'])).buttons.find((b) => b.id === 'review')?.disabled).toBe(true);
    expect(run(['start', 'review']).screen).toBe('menu');
    const cancelled = run(['start', 'tab:drinks', 'item:cola', 'size:large', 'cancel']);
    expect(cancelled.screen).toBe('welcome');
    expect(cancelled.cart).toEqual([]);
  });

  test('totals add every line; overcharge only changes the displayed total', () => {
    const order = run(['start', 'item:cheese', 'add', 'tab:drinks', 'item:cola', 'size:medium', 'review']);
    expect(cartTotal(order)).toBe(720 + 240);
    expect(displayedTotal(order)).toBe(960);
    expect(view(order).total).toBe('$9.60');
    const tampered = run(['start', 'item:cheese', 'add', 'tab:drinks', 'item:cola', 'size:medium', 'review'], newOrder({ overcharge: true }));
    expect(cartTotal(tampered)).toBe(960);
    expect(view(tampered).total).toBe('$11.60');
    expect(view(tampered).texts).toContain('Medium Cola $2.40');
  });

  test('the PIN pad shows PIN wording and all ten digits, and never the digits typed', () => {
    const s = run([...MEDIUM_COLA, 'key:7', 'key:3']);
    const v = view(s);
    expect(v.title).toBe('Enter your PIN');
    expect(v.buttons.filter((b) => b.kind === 'key').map((b) => b.label).sort()).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(v.pinDots).toBe(2);
    expect(JSON.stringify(v)).not.toMatch(/73/);
    expect(view(press(s, 'enter')).screen).toBe('pin'); // fewer than four digits
    expect(run(['clear'], s).pinLength).toBe(0);
  });

  test('pay at counter skips the card and PIN screens', () => {
    const s = run(['start', 'item:fries', 'size:small', 'review', 'pay', 'pay:counter']);
    expect(s.screen).toBe('approved');
    expect(view(s).title).toBe('Pay at the counter');
  });

  test('unknown or out-of-screen actions leave the state unchanged', () => {
    const s = run(['start']);
    expect(press(s, 'key:5')).toBe(s);
    expect(press(s, 'item:nope')).toBe(s);
  });
});
