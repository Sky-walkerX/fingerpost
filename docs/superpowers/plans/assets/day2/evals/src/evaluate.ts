import { readFileSync } from 'node:fs';
import { resolveByText, type ModelPort } from '@fingerpost/gateway/eval-api';
import type { LabeledItem } from './dataset.ts';
import { boxOfPolygon, centreInBox, matchElements, SENSITIVE, type ItemResult } from './metrics.ts';

/** Runs one labeled image through the same parse + resolve + SAM path the gateway uses. */
export async function evaluateItem(models: ModelPort, dir: URL, item: LabeledItem, readImage = (u: URL) => new Uint8Array(readFileSync(u))): Promise<ItemResult> {
  throw new Error('TODO(D2-T8): implement this; the tests describe the behaviour');
}
