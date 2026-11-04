import { expect, test } from 'vitest';
import { LabelFile } from '../../../evals/src/dataset.ts';
import { ElementRole, ScreenType } from '../../../packages/protocol/src/common.ts';
import { labelItem, ROLES, SCREEN_TYPES, type LabelElement } from '../src/label/model.ts';

const image = { name: 'synthetic-panel.jpg', w: 400, h: 300 };
const elements: LabelElement[] = [{ label: 'Start', role: 'button', box: { u: 0.1, v: 0.2, w: 0.3, h: 0.4 } }];

test('the labeler exports an actual evaluator-compatible item with normalized boxes', () => {
  const item = labelItem(image, 'appliance', elements, 'press start | Start');
  expect(LabelFile.parse({ version: 1, items: [item] }).items[0]).toEqual(item);
  expect(item.elements[0]!.box).toEqual(elements[0]!.box);
  expect(ROLES).toEqual(ElementRole.options); expect(SCREEN_TYPES).toEqual(ScreenType.options);
});

test.each(['press start', 'press start |', ' | Start', 'press start | Start | extra'])('malformed goal cannot silently disappear: %s', (goal) => {
  expect(() => labelItem(image, 'appliance', elements, goal)).toThrow('goal | label');
});

test('goals require exact independently labeled controls, never missing or non-tappable text', () => {
  expect(() => labelItem(image, 'appliance', elements, 'press stop | Stop')).toThrow('control');
  expect(() => labelItem(image, 'appliance', [{ ...elements[0]!, role: 'text' }], 'read start | Start')).toThrow('control');
});

test('empty/unlabeled boxes and invalid image metadata cannot be exported', () => {
  expect(() => labelItem(image, 'appliance', [], '')).toThrow();
  expect(() => labelItem(image, 'appliance', [{ ...elements[0]!, label: '  ' }], '')).toThrow();
  expect(() => labelItem({ ...image, w: 0 }, 'appliance', elements, '')).toThrow();
  expect(() => labelItem({ ...image, name: 'panel#1.jpg' }, 'appliance', elements, '')).toThrow();
  expect(() => labelItem(image, 'invalid', elements, '')).toThrow();
});

test('boxes outside the image and zero-area boxes cannot become ground truth', () => {
  for (const box of [{ u: -0.1, v: 0, w: 0.2, h: 0.2 }, { u: 0.8, v: 0, w: 0.3, h: 0.2 },
    { u: 0, v: 0, w: 0, h: 0.2 }, { u: Number.NaN, v: 0, w: 0.2, h: 0.2 }]) {
    expect(() => labelItem(image, 'appliance', [{ ...elements[0]!, box }], '')).toThrow();
  }
});

test('the labeler page names itself with one top-level heading for screen-reader navigation', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../label/index.html', import.meta.url), 'utf8');
  expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
});
