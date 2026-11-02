import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { exportPinTokens, PinTokenFile } from '../scripts/export-pin-tokens.ts';

const dataset = new URL('../datasets/pinpay/', import.meta.url);

test('every pinpay item becomes OCR-like tokens with its expected gate outcome', () => {
  const out = exportPinTokens(dataset);
  expect(PinTokenFile.parse(out)).toEqual(out);
  expect(out.items).toHaveLength(170);
  expect(out.items.filter((i) => i.expectedPin)).toHaveLength(120);
  for (const item of out.items) {
    expect(item.expectedPin).toBe(item.screenType === 'pin_pad');
    expect(item.tokens.length).toBeGreaterThan(0);
    expect(item.aspect).toBe(1280 / 800);
    for (const t of item.tokens) {
      expect(Object.keys(t).sort()).toEqual(['h', 'text', 'u', 'v', 'w']);
      expect(t.u + t.w).toBeLessThanOrEqual(1 + 1e-9);
      expect(t.v + t.h).toBeLessThanOrEqual(1 + 1e-9);
    }
  }
  // Images, file names and goals never leave the dataset folder; only the item's id stays for reports.
  expect(JSON.stringify(out)).not.toMatch(/\.jpg|goal/);
});

test('the committed token file is current (regenerate with pnpm --filter @fingerpost/evals export-pin-tokens)', () => {
  const committed = JSON.parse(readFileSync(new URL('../out/pinpay-tokens.json', import.meta.url), 'utf8'));
  expect(committed).toEqual(exportPinTokens(dataset));
});
