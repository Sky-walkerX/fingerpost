import type OpenAI from 'openai';
import type { Locale } from '@fingerpost/protocol';
import { parseScreen, type ParseResult } from '../parse/spark-parse.ts';
import { segmentByBox, segmentByText, type PxBox, type SamImage, type SegmentResult } from '../parse/sam.ts';

/** Everything the session pipeline needs from models. Live = Meta API; mock = canned answers for dev and CI. */
export interface ModelPort {
  parseScreen(image: { bytes: Uint8Array; mime: 'image/jpeg' }, opts: { locale: Locale; goal?: string }): Promise<ParseResult>;
  segmentByBox(image: SamImage, box: PxBox): Promise<SegmentResult>;
  segmentByText(image: SamImage, phrase: string): Promise<SegmentResult>;
}

export function liveModels(client: OpenAI): ModelPort {
  return {
    parseScreen: (img, o) => parseScreen(client, img, o),
    segmentByBox: (img, box) => segmentByBox(client, img, box),
    segmentByText: (img, phrase) => segmentByText(client, img, phrase),
  };
}
