import OpenAI from 'openai';
import { MODELS } from './meta-client.ts';
import type { Locale } from '@fingerpost/protocol';
import { parseScreen, type ParseResult } from '../parse/spark-parse.ts';
import { segmentByBox, segmentByText, type PxBox, type SamImage, type SegmentResult } from '../parse/sam.ts';

/** Everything the session pipeline needs from models. Live = Meta API; mock = canned answers for dev and CI. */
export interface ModelPort {
  parseScreen(image: { bytes: Uint8Array; mime: 'image/jpeg' }, opts: { locale: Locale; goal?: string }): Promise<ParseResult>;
  segmentByBox(image: SamImage, box: PxBox): Promise<SegmentResult>;
  segmentByText(image: SamImage, phrase: string): Promise<SegmentResult>;
}

/** A provider-side failure worth one try on the older Spark: a timeout or a 5xx. Bad requests (4xx) are not. */
export function sparkFallbackWorthy(error: unknown): boolean {
  if (error instanceof OpenAI.APIConnectionTimeoutError) return true;
  return error instanceof OpenAI.APIError && typeof error.status === 'number' && error.status >= 500;
}

export function liveModels(client: OpenAI): ModelPort {
  return {
    // Days 4–7 plan, B4-1: Spark 1.3, then Spark 1.2 once on a timeout or 5xx. No other retries here (B5-3).
    parseScreen: (img, o) => parseScreen(client, img, o, MODELS.spark).catch((error: unknown) => {
      if (!sparkFallbackWorthy(error)) throw error;
      return parseScreen(client, img, o, MODELS.sparkFallback);
    }),
    segmentByBox: (img, box) => segmentByBox(client, img, box),
    segmentByText: (img, phrase) => segmentByText(client, img, phrase),
  };
}
