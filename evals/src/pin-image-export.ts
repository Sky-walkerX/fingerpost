import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { loadLabels } from './dataset.ts';
import type { ItemResult } from './metrics.ts';

export const NumericPinResults = z.strictObject({ version: z.literal(1), mode: z.enum(['mock', 'live', 'private']),
  items: z.array(z.strictObject({ id: z.string().regex(/^sample-\d{6}$/), sha256: z.string().regex(/^[a-f0-9]{64}$/),
    expectedSensitive: z.boolean(), serverDetected: z.boolean() })).max(1000)
    .refine(items => new Set(items.map(i => i.id)).size === items.length),
});
export type NumericPinResults = z.infer<typeof NumericPinResults>;
const idAt = (i: number) => `sample-${String(i + 1).padStart(6, '0')}`;
const digest = (u: URL) => createHash('sha256').update(readFileSync(u)).digest('hex');

/** This export intentionally omits source names, goals, labels and OCR. Mock mode stays explicitly marked. */
export function numericPinResults(mode: NumericPinResults['mode'], results: readonly ItemResult[], dir: URL): NumericPinResults {
  return NumericPinResults.parse({ version: 1, mode, items: results.map((r, i) => ({ id: idAt(i),
    sha256: digest(new URL(r.image, dir)), expectedSensitive: r.gtSensitive, serverDetected: r.predSensitive })) });
}

/** Copies permissioned local images into an anonymous, hash-bound bundle for the camera-free Android runner. */
export function preparePinImages(dir: URL, out: string, origin: 'sim' | 'real', evidence?: unknown): void {
  const labels = loadLabels(dir);
  if (labels.items.length > 1000 || !['sim', 'real'].includes(origin)) throw new Error('Invalid image corpus');
  const server = evidence === undefined ? undefined : NumericPinResults.parse(evidence);
  if (server?.mode === 'mock') throw new Error('Mock results cannot measure server recall');
  const used = new Set<string>();
  const samples = labels.items.map((item, i) => {
    const id = idAt(i), file = new URL(item.image, dir), sha256 = digest(file);
    if (statSync(file).size > 8 * 1024 * 1024) throw new Error('Image exceeds evaluation bound');
    const format = item.image.toLowerCase().endsWith('.jpg') || item.image.toLowerCase().endsWith('.jpeg') ? 'jpg'
      : item.image.toLowerCase().endsWith('.png') ? 'png' : undefined;
    if (!format) throw new Error('Unsupported image format');
    const expectedSensitive = ['pin_pad', 'payment_entry'].includes(item.screenType);
    const prediction = server?.items.find(row => row.id === id);
    if (prediction && (prediction.sha256 !== sha256 || prediction.expectedSensitive !== expectedSensitive))
      throw new Error('Server evidence does not match image ground truth');
    if (prediction) used.add(id);
    return { file, row: { id, sha256, format, origin, expectedLocalBlock: item.screenType === 'pin_pad',
      expectedSensitive, serverDetected: prediction?.serverDetected ?? null } };
  });
  if (server && used.size !== server.items.length) throw new Error('Unmatched server evidence');
  mkdirSync(out); // Exclusive: an existing dataset must never be replaced.
  try {
    for (const { file, row } of samples) copyFileSync(file, join(out, `${row.id}.${row.format}`));
    writeFileSync(join(out, 'manifest.json'), JSON.stringify({ version: 1, items: samples.map(s => s.row) }) + '\n', { flag: 'wx' });
  } catch (error) { rmSync(out, { recursive: true, force: true }); throw error; }
}
