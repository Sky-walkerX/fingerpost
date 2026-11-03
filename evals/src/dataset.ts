import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { z } from 'zod';
import { Box, ElementRole, ScreenType } from '@fingerpost/protocol';

export const DatasetName = z.string().regex(/^(?:private\/)?[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/);

/** evals/datasets/<set>/labels.json. Boxes are normalized to the image (u, v, w, h). */
export const LabelFile = z.object({
  version: z.literal(1),
  items: z.array(z.object({
    image: z.string().min(1).refine((image) => !/[\\:%?#\u0000-\u001f]/u.test(image)
      && image.split('/').every((part) => part !== '' && part !== '.' && part !== '..'), 'Use a relative dataset image path'),
    imageSize: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
    screenType: ScreenType,
    elements: z.array(z.object({ label: z.string().min(1), role: ElementRole, box: Box })),
    goals: z.array(z.object({ goal: z.string().min(1), label: z.string().min(1) })).default([]),
  }).refine((item) => item.goals.every((goal) => item.elements.some((element) => element.label === goal.label && element.role !== 'text')),
    'Each goal needs a ground-truth control')).min(1),
});
export type LabelFile = z.infer<typeof LabelFile>;
export type LabeledItem = LabelFile['items'][number];

export function loadLabels(dir: URL): LabelFile {
  const labels = LabelFile.parse(JSON.parse(readFileSync(new URL('labels.json', dir), 'utf8')));
  const root = realpathSync(dir);
  // Check every image, including symlink destinations, before any paid request.
  for (const item of labels.items) {
    const image = realpathSync(new URL(item.image, dir));
    const path = relative(root, image);
    if (isAbsolute(path) || path === '..' || path.startsWith('../') || path.startsWith('..\\') || !statSync(image).isFile()) {
      throw new Error('Evaluation image must stay inside its dataset');
    }
  }
  return labels;
}
