import { expect, test } from 'vitest';
import type { LayoutElement } from '@fingerpost/protocol';
import { describePosition, listLabels } from '../src/resolve/describe.ts';
import { resolveByText, tokenSetRatio } from '../src/resolve/match.ts';

const el = (id: string, label: string, extra: Partial<LayoutElement> = {}): LayoutElement => ({
  id, label, role: 'button', confidence: 0.9,
  polygon: [{ u: 0, v: 0 }, { u: 0.1, v: 0 }, { u: 0.1, v: 0.1 }], ...extra,
});

test('empty normalized token sets score zero and repeated tokens do not affect the ratio', () => {
  expect(tokenSetRatio('!!!', 'start')).toBe(0);
  expect(tokenSetRatio('start', '')).toBe(0);
  expect(tokenSetRatio('start start now', 'now later')).toBe(0.5);
});

test('exact matches normalize Unicode and punctuation and do not duplicate aliases', () => {
  expect(resolveByText('Please tap ＳＴＡＲＴ!', [el('a', 'Start', { labelLocal: 'Start', textNorm: 'start' })]))
    .toMatchObject({ kind: 'match', element: { id: 'a' }, score: 1 });
});

test('duplicate exact controls are ambiguous even when fuzzy alternatives also match', () => {
  expect(resolveByText('Start', [el('a', 'Start'), el('b', 'Start'), el('c', 'Start now')]))
    .toMatchObject({ kind: 'ambiguous', candidates: [{ id: 'a' }, { id: 'b' }] });
});

test('textNorm can resolve a target and text-role aliases remain excluded', () => {
  expect(resolveByText('Timer', [el('a', 'Synthetic display', { role: 'text', textNorm: 'timer' }),
    el('b', 'Synthetic control', { textNorm: 'timer' })]))
    .toMatchObject({ kind: 'match', element: { id: 'b' } });
});

test('fuzzy score 0.8 is included while a lower score is rejected', () => {
  expect(resolveByText('one two three four five', [el('a', 'one two three four six')]))
    .toMatchObject({ kind: 'match', score: 0.8 });
  expect(resolveByText('one two three four five', [el('a', 'one two three six seven')])).toEqual({ kind: 'none' });
});

test('all candidates within 0.05 of the best are ambiguous in descending stable order', () => {
  const words = Array.from({ length: 20 }, (_, i) => `word${i}`);
  const goal = words.join(' ');
  const candidates = [el('low', [...words.slice(0, 18), 'other', 'extra'].join(' ')),
    el('edge', [...words.slice(0, 19), 'other'].join(' ')), el('best', `${goal} extra`)];
  expect(resolveByText(goal, candidates)).toMatchObject({ kind: 'ambiguous', candidates: [{ id: 'best' }, { id: 'edge' }] });
  expect(candidates.map(({ id }) => id)).toEqual(['low', 'edge', 'best']);
});

test('a clear fuzzy winner is selected over a lower qualifying candidate', () => {
  expect(resolveByText('one two three four five', [el('low', 'one two three four six'), el('best', 'one two')]))
    .toMatchObject({ kind: 'match', element: { id: 'best' }, score: 1 });
});

test('position words cover all nine cells using the vertex mean', () => {
  const words = ['top left', 'top', 'top right', 'middle left', 'middle', 'middle right', 'bottom left', 'bottom', 'bottom right'];
  const positions = [0.1, 0.5, 0.9].flatMap((v) => [0.1, 0.5, 0.9].map((u) =>
    describePosition([{ u: u - 0.01, v }, { u: u + 0.01, v }, { u, v }])));
  expect(positions).toEqual(words);
});

test('position boundaries at one and two thirds belong to the middle row/column', () => {
  expect(describePosition([{ u: 1 / 3, v: 1 / 3 }])).toBe('middle');
  expect(describePosition([{ u: 2 / 3, v: 2 / 3 }])).toBe('middle');
});

test('label lists omit text roles, preserve order and format zero through three controls', () => {
  const controls = [el('t', 'Ignore', { role: 'text' }), el('a', 'Timer'), el('b', 'Power'), el('c', 'Start')];
  expect(listLabels([])).toBe('');
  expect(listLabels(controls, 1)).toBe('Timer');
  expect(listLabels(controls, 2)).toBe('Timer and Power');
  expect(listLabels(controls)).toBe('Timer, Power and Start');
  expect(listLabels(controls, 0)).toBe('');
});
