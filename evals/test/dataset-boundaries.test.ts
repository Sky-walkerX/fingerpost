import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, test } from 'vitest';
import { LabelFile, loadLabels } from '../src/dataset.ts';

const item = { image: 'synthetic.jpg', imageSize: { w: 1000, h: 500 }, screenType: 'appliance',
  elements: [{ label: 'Synthetic', role: 'button', box: { u: 0.1, v: 0.2, w: 0.3, h: 0.2 } }],
  goals: [{ goal: 'press synthetic', label: 'Synthetic' }] };
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

test.each(['../private.jpg', '/tmp/private.jpg', 'file:///tmp/private.jpg', 'https://private.example/image.jpg',
  '%2e%2e/private.jpg', 'nested/../../private.jpg', 'image.jpg?private', 'image.jpg#private', 'nested\\private.jpg'])('label image cannot escape the local dataset: %s', (image) => {
  expect(LabelFile.safeParse({ version: 1, items: [{ ...item, image }] }).success).toBe(false);
});

test('an empty dataset and goals with no ground-truth control are rejected', () => {
  expect(LabelFile.safeParse({ version: 1, items: [] }).success).toBe(false);
  expect(LabelFile.safeParse({ version: 1, items: [{ ...item, goals: [{ goal: 'press other', label: 'Missing' }] }] }).success).toBe(false);
});

test('all images must exist before model evaluation begins', () => {
  const root = mkdtempSync(join(tmpdir(), 'fingerpost-eval-preflight-'));
  roots.push(root);
  writeFileSync(join(root, 'labels.json'), JSON.stringify({ version: 1, items: [item] }));
  expect(() => loadLabels(pathToFileURL(root + '/'))).toThrow();
});

test('symlinked images cannot read files outside the dataset', () => {
  const root = mkdtempSync(join(tmpdir(), 'fingerpost-eval-containment-'));
  roots.push(root);
  const dataset = join(root, 'dataset');
  mkdirSync(dataset);
  writeFileSync(join(root, 'synthetic-private.jpg'), new Uint8Array([0xff, 0xd8]));
  symlinkSync(join(root, 'synthetic-private.jpg'), join(dataset, 'synthetic.jpg'));
  writeFileSync(join(dataset, 'labels.json'), JSON.stringify({ version: 1, items: [item] }));
  expect(() => loadLabels(pathToFileURL(dataset + '/'))).toThrow();
});
