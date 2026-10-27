import type OpenAI from 'openai';
import { buildObjectPrompt, decodeMaskToRaster, parseImageStream, recordsOfKind, type SegmentationBoxRecord, type SegmentationMaskRecord, type SegmentationRecord } from '@meta-sam/parser';
import type { Polygon } from '@fingerpost/protocol';
import { MODELS, toDataUrl } from '../models/meta-client.ts';
import { rasterToPolygon, simplifyPolygon, toUV } from './geometry.ts';

export interface SamImage { bytes: Uint8Array; width: number; height: number; }
export interface PxBox { left: number; top: number; right: number; bottom: number; }
export interface SegmentResult { polygon: Polygon | null; confidence: number | null; latencyMs: number; }
type Events = AsyncIterable<{ readonly type: string }>;

/** Highest confidence wins (mask's own, else its box's); ties go to the larger area; null when there are no masks. */
export function pickPrimaryMask(records: readonly SegmentationRecord[]): { mask: SegmentationMaskRecord; confidence: number | null } | null {
  throw new Error('TODO(D1-T4): implement this; the tests describe the behaviour');
}

/** Mask (raster local to its bounds) → simplified polygon in screen-normalized coordinates of the full image. */
export function maskToPolygon(m: SegmentationMaskRecord, imageW: number, imageH: number): Polygon | null {
  throw new Error('TODO(D1-T4): implement this; the tests describe the behaviour');
}

async function run(client: OpenAI, image: SamImage, text: string, events?: Events): Promise<SegmentResult> {
  throw new Error('TODO(D1-T4): implement this; the tests describe the behaviour');
}

/** Box prompt in image pixels. Coordinates are floored/clamped into the image so buildObjectPrompt never throws. */
export function segmentByBox(client: OpenAI, image: SamImage, box: PxBox, events?: Events): Promise<SegmentResult> {
  throw new Error('TODO(D1-T4): implement this; the tests describe the behaviour');
}

/** Text concept prompt: a short noun phrase such as "touchscreen display", never a command or question. */
export function segmentByText(client: OpenAI, image: SamImage, phrase: string, events?: Events): Promise<SegmentResult> {
  throw new Error('TODO(D1-T4): implement this; the tests describe the behaviour');
}
