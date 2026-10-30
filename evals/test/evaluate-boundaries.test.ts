import { expect, test, vi } from 'vitest';
import { mockModels, MOCK_LAYOUT } from '@fingerpost/gateway/eval-api';
import { evaluateItem } from '../src/evaluate.ts';
import type { LabeledItem } from '../src/dataset.ts';
import { renderReport, summarize } from '../src/metrics.ts';

const dir = new URL('../datasets/mock-panel/', import.meta.url);
const item: LabeledItem = { image: 'synthetic-private-recognized-name.jpg', imageSize: { w: 1000, h: 500 }, screenType: 'appliance',
  elements: [{ label: 'Start', role: 'button', box: { u: 0.6, v: 0.7, w: 0.3, h: 0.18 } }],
  goals: [{ goal: 'press start', label: 'Start' }] };
const readImage = () => new Uint8Array([0xff, 0xd8]);

test('public reports anonymize filenames and omit recognized goals', async () => {
  const result = await evaluateItem(mockModels(), dir, item, readImage);
  const report = renderReport('Evaluation', summarize([result]), [result], { mode: 'mock' });
  expect(report).not.toContain('synthetic-private-recognized-name');
  expect(report).not.toContain('press start');
  expect(report).toContain('sample-001');
});

test('unmatched and ambiguous goals never call SAM or produce guessed hits', async () => {
  const models = mockModels({ ...MOCK_LAYOUT, elements: [MOCK_LAYOUT.elements[4]!, { ...MOCK_LAYOUT.elements[4]!, id: 'duplicate' }] });
  const segment = vi.spyOn(models, 'segmentByBox');
  const result = await evaluateItem(models, dir, { ...item, goals: [...item.goals, { goal: 'missing', label: 'Start' }] }, readImage);
  expect(result.goals.map((goal) => goal.hit)).toEqual([false, false]);
  expect(segment).not.toHaveBeenCalled();
});

test('SAM receives the exact resolved pixel box and its mask determines the target hit', async () => {
  const models = mockModels();
  const segment = vi.spyOn(models, 'segmentByBox').mockResolvedValue({
    polygon: [{ u: 0, v: 0 }, { u: 0.1, v: 0 }, { u: 0.1, v: 0.1 }], confidence: 0.9, latencyMs: 2,
  });
  const result = await evaluateItem(models, dir, item, readImage);
  expect(segment).toHaveBeenCalledWith(expect.objectContaining({ width: 1000, height: 500 }),
    { left: 600, top: 350, right: 900, bottom: 440 });
  expect(result.goals[0]?.hit).toBe(false);
  expect(result.samCalls).toBe(1);
});

test('null SAM masks use the same Spark-box fallback as the session pipeline', async () => {
  const models = mockModels();
  vi.spyOn(models, 'segmentByBox').mockResolvedValue({ polygon: null, confidence: null, latencyMs: 2 });
  const result = await evaluateItem(models, dir, item, readImage);
  expect(result.goals[0]?.hit).toBe(true);
  expect(result.samCalls).toBe(1);
});
