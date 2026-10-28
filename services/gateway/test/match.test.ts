import { expect, test } from 'vitest';
import type { LayoutElement } from '@fingerpost/protocol';
import { goalCore, resolveByText, tokenSetRatio } from '../src/resolve/match.ts';

const poly = [{ u: 0, v: 0 }, { u: 0.1, v: 0 }, { u: 0.1, v: 0.1 }];
const el = (id: string, label: string, role: LayoutElement['role'] = 'button', labelLocal?: string): LayoutElement =>
  ({ id, label, role, polygon: poly, confidence: 0.9, ...(labelLocal ? { labelLocal } : {}) });

test('tokenSetRatio: containment scores 1, disjoint 0, partial overlap in between', () => {
  expect(tokenSetRatio('start', 'Start order')).toBe(1);
  expect(tokenSetRatio('timer', 'start')).toBe(0);
  expect(tokenSetRatio('quick start now', 'start later')).toBeCloseTo(0.4);
});
test('goalCore strips command words in English, Hindi and Spanish', () => {
  expect(goalCore('Press the Start button')).toBe('start');
  expect(goalCore('स्टार्ट बटन दबाएं')).toBe('स्टार्ट');
  expect(goalCore('Pulsa el botón Iniciar')).toBe('iniciar');
});
test('exact label wins over containment', () => {
  const r = resolveByText('press start', [el('a', 'Quick start'), el('b', 'Start')]);
  expect(r).toMatchObject({ kind: 'match', element: { id: 'b' } });
});
test('two equally good matches → ambiguous', () => {
  const r = resolveByText('start', [el('a', 'Start timer'), el('b', 'Start cooking')]);
  expect(r.kind).toBe('ambiguous');
  if (r.kind === 'ambiguous') expect(r.candidates.map((c) => c.id).sort()).toEqual(['a', 'b']);
});
test('matches the localized label too', () => {
  expect(resolveByText('भुगतान', [el('p', 'Pay', 'pay', 'भुगतान')])).toMatchObject({ kind: 'match', element: { id: 'p' } });
});
test('text elements are never targets', () => {
  expect(resolveByText('total', [el('t', 'Total ₹149', 'text')])).toEqual({ kind: 'none' });
});
test('nothing close enough → none; empty goal → none', () => {
  expect(resolveByText('defrost', [el('a', 'Start'), el('b', 'Timer')])).toEqual({ kind: 'none' });
  expect(resolveByText('press the button', [el('a', 'Start')])).toEqual({ kind: 'none' });
});
