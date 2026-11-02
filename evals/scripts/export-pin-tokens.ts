// Days 4–7 plan, C4-4 (mock-first): the pinpay sim items as on-device OCR tokens, for the Kotlin local
// PIN-gate recall test (core:guidance PinGateDatasetTest). Synthetic sim labels only; no images.
// pnpm --filter @fingerpost/evals export-pin-tokens
import { mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { loadLabels } from '../src/dataset.ts';

export const PinTokenFile = z.strictObject({
  version: z.literal(1),
  items: z.array(z.strictObject({
    id: z.string().min(1),
    screenType: z.enum(['pin_pad', 'payment_entry']),
    /** pin_pad → the local gate must block it. payment_entry here is an amount summary with a Pay button, which stays online for the confirm turn (guidance-spec §10.1). */
    expectedPin: z.boolean(),
    /** Width ÷ height of the image in pixels: the PIN gate's tolerances are in pixels (guidance-spec §10.1). */
    aspect: z.number().positive(),
    tokens: z.array(z.strictObject({ text: z.string().min(1), u: z.number(), v: z.number(), w: z.number(), h: z.number() })),
  })),
});
export type PinTokenFile = z.infer<typeof PinTokenFile>;

export function exportPinTokens(dataset: URL): PinTokenFile {
  const { items } = loadLabels(dataset);
  return PinTokenFile.parse({ version: 1, items: items.map((item) => {
    if (item.screenType !== 'pin_pad' && item.screenType !== 'payment_entry') throw new Error('pinpay holds only PIN and payment screens');
    return {
      id: item.image.replace(/\.jpg$/, ''),
      screenType: item.screenType,
      expectedPin: item.screenType === 'pin_pad',
      aspect: item.imageSize.w / item.imageSize.h,
      tokens: item.elements.map(({ label, box }) => ({ text: label, u: box.u, v: box.v, w: box.w, h: box.h })),
    };
  }) });
}

if (import.meta.main) {
  const out = new URL('../out/', import.meta.url);
  mkdirSync(out, { recursive: true });
  const file = exportPinTokens(new URL('../datasets/pinpay/', import.meta.url));
  writeFileSync(new URL('pinpay-tokens.json', out), JSON.stringify(file) + '\n');
  console.log(JSON.stringify({ items: file.items.length, expectedPin: file.items.filter((i) => i.expectedPin).length }));
}
