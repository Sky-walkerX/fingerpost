import { expect, test } from 'vitest';
import { loadLabels } from '../src/dataset.ts';

test('pinpay dataset: 150+ labeled items, every layout covered, pay goals point at a pay element', () => {
  const { items } = loadLabels(new URL('../datasets/pinpay/', import.meta.url));
  expect(items.length).toBeGreaterThanOrEqual(150);
  for (const layout of ['phone', 'calculator', 'scrambled']) expect(items.filter((i) => i.image.startsWith(`pin-${layout}-`))).toHaveLength(40);
  for (const item of items.filter((i) => i.screenType === 'payment_entry')) {
    for (const g of item.goals) expect(item.elements.find((e) => e.label === g.label)?.role).toBe('pay');
  }
});
