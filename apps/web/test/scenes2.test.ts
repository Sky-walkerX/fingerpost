import { describe, expect, test } from 'vitest';
import { buildTicket } from '../src/sim/scenes/ticket.ts';
import { buildCooktop } from '../src/sim/scenes/cooktop.ts';
import { applyTouch, currentScreen, newRun } from '../src/sim/log.ts';
import { postTouch } from '../src/sim/net.ts';
import { CANVAS, type SimElement, type SimScene } from '../src/sim/model.ts';

const centre = (e: SimElement) => ({ x: e.rect.x + e.rect.w / 2, y: e.rect.y + e.rect.h / 2 });
const overlaps = (a: SimElement, b: SimElement) => a.rect.x < b.rect.x + b.rect.w && b.rect.x < a.rect.x + a.rect.w && a.rect.y < b.rect.y + b.rect.h && b.rect.y < a.rect.y + a.rect.h;
const sane = (build: (seed: number) => SimScene) => {
  for (let seed = 1; seed <= 50; seed++) for (const s of build(seed).screens) {
    for (const e of s.elements) { expect(e.rect.x + e.rect.w).toBeLessThanOrEqual(CANVAS.w); expect(e.rect.y + e.rect.h).toBeLessThanOrEqual(CANVAS.h); expect(Math.min(e.rect.x, e.rect.y)).toBeGreaterThanOrEqual(0); }
    for (let i = 0; i < s.elements.length; i++) for (let j = i + 1; j < s.elements.length; j++) expect(overlaps(s.elements[i]!, s.elements[j]!)).toBe(false);
    for (const target of Object.values(s.next)) expect(build(seed).screens.some((x) => x.id === target)).toBe(true);
  }
};

describe('ticket machine', () => {
  test('layouts are sane for seeds 1–50 and every next target exists', () => sane(buildTicket));
  test('full purchase path ends on done with two pay options on the pay screen', () => {
    const s = newRun('r', buildTicket(2));
    for (const id of ['hindi', 'rajiv-chowk', 'two']) applyTouch(s, { ...centre(currentScreen(s).elements.find((e) => e.id === id)!), pointerId: 1, ts: 0 });
    expect(s.screenId).toBe('pay');
    expect(currentScreen(s).elements.filter((e) => e.role === 'pay').map((e) => e.label)).toEqual(['Pay by card', 'Pay by UPI']);
  });
});

describe('cooktop', () => {
  test('layout is sane and fixed across seeds except the display', () => {
    sane(buildCooktop);
    const a = buildCooktop(1).screens[0]!.elements, b = buildCooktop(7).screens[0]!.elements;
    expect(a.slice(1)).toEqual(b.slice(1));
    expect([a[0]!.label, b[0]!.label]).toEqual(['1', '7']);
  });
  test('five icon keys and one text button, no navigation', () => {
    const els = buildCooktop(3).screens[0]!.elements;
    expect(els.filter((e) => e.role === 'icon')).toHaveLength(5);
    expect(buildCooktop(3).screens[0]!.next).toEqual({});
  });
});

describe('postTouch', () => {
  const ev = { runId: 'r1', screenId: 'home', x: 1, y: 2, u: 0.1, v: 0.2, elementId: null, pointerId: 1, ts: 9 };
  test('POSTs the event (without pointerId) with the sim token header', async () => {
    let call: [string, RequestInit] | undefined;
    const ok = await postTouch(ev, { gatewayUrl: 'http://gw:8080', token: 'tok-12345', fetchImpl: (async (u: URL, init: RequestInit) => { call = [String(u), init]; return new Response('{}', { status: 200 }); }) as typeof fetch });
    expect(ok).toBe(true);
    expect(call![0]).toBe('http://gw:8080/v1/sim/events');
    expect((call![1].headers as Record<string, string>)['x-sim-token']).toBe('tok-12345');
    expect(JSON.parse(call![1].body as string)).toEqual({ runId: 'r1', screenId: 'home', x: 1, y: 2, u: 0.1, v: 0.2, elementId: null, ts: 9 });
  });
  test('network failure → false, never throws', async () => {
    expect(await postTouch(ev, { gatewayUrl: 'http://gw', fetchImpl: (async () => { throw new Error('offline'); }) as typeof fetch })).toBe(false);
  });
});
