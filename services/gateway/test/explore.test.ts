import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { Layout, LayoutElement } from '@fingerpost/protocol';
import { firstSay, isMore, MORE_PROMPT, nextSay, summarize } from '../src/explore/summary.ts';
import { layoutFingerprint } from '../src/session/pipeline.ts';

const box = (u: number, v: number): LayoutElement['polygon'] => [{ u, v }, { u: u + 0.1, v }, { u: u + 0.1, v: v + 0.08 }, { u, v: v + 0.08 }];
const el = (id: string, label: string, u: number, v: number, role: LayoutElement['role'] = 'button'): LayoutElement =>
  ({ id, label, role, polygon: box(u, v), confidence: 0.9, textNorm: label.toLowerCase() });
const layout = (elements: LayoutElement[]): Layout => ({ id: 'l', ts: 0, type: 'layout', fingerprint: layoutFingerprint(elements),
  screenType: 'menu', rotation: 0, language: 'en', sensitivity: 'none', elements, source: 'model' });

// Six regions: top/middle/bottom × left/right.
const busy = layout([
  el('t1', 'Burgers', 0.05, 0.1), el('t2', 'Drinks', 0.25, 0.1), el('t3', 'Sides', 0.7, 0.1),
  el('m1', 'Small', 0.1, 0.45), el('m2', 'Large', 0.8, 0.45),
  el('b1', 'Back', 0.05, 0.85, 'back'), el('b2', 'Pay by card', 0.75, 0.85, 'pay'),
]);
const sentences = (text: string) => text.split(/(?<=[.।])\s+/).filter(Boolean);

describe('explore summary (B5-1)', () => {
  test('three sentences max', () => {
    const { regions } = summarize(busy, 'en');
    expect(regions.length).toBe(6);
    const say = firstSay(regions, 'en');
    expect(say.endsWith(MORE_PROMPT.en)).toBe(true);
    expect(sentences(say.slice(0, -MORE_PROMPT.en.length).trim()).length).toBeLessThanOrEqual(3);
    expect(say).toContain('At the top left: Burgers and Drinks.');
    expect(say).toContain('At the top right: Sides.');
  });

  test('more returns next region', () => {
    const { regions } = summarize(busy, 'en');
    expect(nextSay(regions, 3, 'en')).toEqual({ text: 'In the middle right: Large.', cursor: 4 });
    expect(nextSay(regions, 4, 'en').text).toBe('At the bottom left: Back.');
    expect(nextSay(regions, 6, 'en')).toEqual({ text: "That's everything on the screen.", cursor: 6 });
    for (const more of ['more', 'More.', 'más', 'mas', 'और', 'tell me more']) expect(isMore(more)).toBe(true);
    for (const other of ['press start', 'order more fries']) expect(isMore(other)).toBe(false);
  });

  test('text role elements included as context', () => {
    const { regions } = summarize(layout([el('w', 'Welcome to Fingerburger', 0.3, 0.1, 'text'), el('s', 'Start order', 0.4, 0.5)]), 'en');
    expect(regions.join(' ')).toContain('Welcome to Fingerburger');
    expect(regions.join(' ')).toContain('Start order');
  });

  test('at most 5 labels per sentence', () => {
    const row = layout(Array.from({ length: 8 }, (_, i) => el(`k${i}`, `Key ${i}`, 0.01 + i * 0.05, 0.1)));
    const { regions } = summarize(row, 'en');
    expect(regions[0]).toBe('At the top left: Key 0, Key 1, Key 2, Key 3, Key 4 and 3 more.');
  });

  test('hindi output', () => {
    const { regions } = summarize(busy, 'hi');
    expect(regions[0]).toBe('ऊपर बाईं ओर: Burgers और Drinks।');
    expect(firstSay(regions, 'hi').endsWith(MORE_PROMPT.hi)).toBe(true);
    expect(summarize(busy, 'es').regions[0]).toBe('Arriba a la izquierda: Burgers y Drinks.');
  });

  test('the shared explore flow asks only for an explore summary (contract shape)', () => {
    const flow = JSON.parse(readFileSync(new URL('../../../packages/protocol/fixtures/flows/explore-summary.json', import.meta.url), 'utf8'));
    expect(flow.steps.some((s: { msg: { type: string; text?: string } }) => s.msg.type === 'goal' && isMore(s.msg.text ?? ''))).toBe(true);
  });
});
