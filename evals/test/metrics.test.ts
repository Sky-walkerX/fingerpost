import { expect, test } from 'vitest';
import { mockModels } from '@fingerpost/gateway/eval-api';
import { loadLabels } from '../src/dataset.ts';
import { evaluateItem } from '../src/evaluate.ts';
import { centreInBox, costUsd, iou, matchElements, percentile, renderReport, summarize } from '../src/metrics.ts';

const box = (u: number, v: number, w: number, h: number) => ({ u, v, w, h });

test('iou: identical 1, disjoint 0, half-overlap 1/3', () => {
  expect(iou(box(0, 0, 1, 1), box(0, 0, 1, 1))).toBe(1);
  expect(iou(box(0, 0, 0.1, 0.1), box(0.5, 0.5, 0.1, 0.1))).toBe(0);
  expect(iou(box(0, 0, 0.2, 0.1), box(0.1, 0, 0.2, 0.1))).toBeCloseTo(1 / 3);
});
test('matchElements is one-to-one and needs both IoU and label agreement', () => {
  const gt = [{ label: 'Start', box: box(0.6, 0.7, 0.3, 0.2) }, { label: 'Stop', box: box(0.1, 0.7, 0.3, 0.2) }];
  const pred = [
    { label: 'Start', box: box(0.61, 0.7, 0.3, 0.2) },
    { label: 'Start', box: box(0.6, 0.71, 0.3, 0.2) }, // duplicate → fp
    { label: 'Timer', box: box(0.1, 0.7, 0.3, 0.2) },  // right place, wrong label → fp, Stop stays fn
  ];
  expect(matchElements(pred, gt)).toMatchObject({ tp: 1, fp: 2, fn: 1 });
});
test('percentile uses nearest rank', () => {
  expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
  expect(percentile([1, 2, 3, 4, 100], 95)).toBe(100);
  expect(Number.isNaN(percentile([], 50))).toBe(true);
});
test('centreInBox and cost', () => {
  expect(centreInBox([{ u: 0.6, v: 0.7 }, { u: 0.9, v: 0.9 }], box(0.6, 0.7, 0.3, 0.2))).toBe(true);
  expect(costUsd(1_000_000, 0, 0)).toBeCloseTo(1.25);
  expect(costUsd(1600, 200, 1)).toBeCloseTo(0.00285);
});
test('mock dataset end to end: Start found and hit, Light missed, PIN pad missed (mock never says pin_pad)', async () => {
  const dir = new URL('../datasets/mock-panel/', import.meta.url);
  const labels = loadLabels(dir);
  const results = [];
  for (const item of labels.items) results.push(await evaluateItem(mockModels(), dir, item));
  const s = summarize(results);
  expect(results[0]!.goals).toEqual([{ goal: 'press start', hit: true }, { goal: 'light', hit: false }]);
  expect(s).toMatchObject({ items: 2, targetHitRate: 0.5, pinPaymentItems: 1, pinPaymentRecall: 0 });
  expect(s.recall).toBeCloseTo(4 / 5);
  expect(renderReport('t', s, results, { mode: 'mock' })).toContain('| Target hit rate | 50.0% |');
});
