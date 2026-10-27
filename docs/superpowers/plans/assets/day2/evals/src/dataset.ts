import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { Box, ElementRole, ScreenType } from '@fingerpost/protocol';

/** evals/datasets/<set>/labels.json. Boxes are normalized to the image (u, v, w, h). */
export const LabelFile = z.object({
  version: z.literal(1),
  items: z.array(z.object({
    image: z.string().min(1),
    imageSize: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
    screenType: ScreenType,
    elements: z.array(z.object({ label: z.string().min(1), role: ElementRole, box: Box })),
    goals: z.array(z.object({ goal: z.string().min(1), label: z.string().min(1) })).default([]),
  })),
});
export type LabelFile = z.infer<typeof LabelFile>;
export type LabeledItem = LabelFile['items'][number];

export const loadLabels = (dir: URL): LabelFile => LabelFile.parse(JSON.parse(readFileSync(new URL('labels.json', dir), 'utf8')));
