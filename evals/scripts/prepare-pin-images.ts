import { mkdirSync, readFileSync, writeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { preparePinImages } from '../src/pin-image-export.ts';
import { DatasetName } from '../src/dataset.ts';

export function main(args = process.argv.slice(2)): number {
  try {
    const { values } = parseArgs({ args, options: { set: { type: 'string' }, out: { type: 'string' },
      origin: { type: 'string' }, 'server-results': { type: 'string' } } });
    const opts = z.strictObject({ set: DatasetName, out: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/),
      origin: z.enum(['sim', 'real']), 'server-results': z.string().optional() }).parse(values);
    const root = new URL('../datasets/private/', import.meta.url); mkdirSync(root, { recursive: true });
    preparePinImages(new URL(`../datasets/${opts.set}/`, import.meta.url), fileURLToPath(new URL(opts.out, root)), opts.origin,
      opts['server-results'] ? JSON.parse(readFileSync(opts['server-results'], 'utf8')) : undefined);
    writeSync(1, 'Private image bundle prepared. Device OCR has not run.\n');
    return 0;
  } catch { writeSync(2, 'Image bundle preparation failed. Check the private dataset and evidence.\n'); return 1; }
}
if (import.meta.main) process.exitCode = main();
