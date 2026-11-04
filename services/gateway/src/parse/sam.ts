import type OpenAI from 'openai';
import { buildObjectPrompt, decodeMaskToRaster, parseImageStream, recordsOfKind, type SegmentationBoxRecord, type SegmentationMaskRecord, type SegmentationRecord } from '@meta-sam/parser';
import type { Polygon } from '@fingerpost/protocol';
import { MODELS, toDataUrl } from '../models/meta-client.ts';
import { rasterToPolygon, simplifyPolygon, toUV } from './geometry.ts';
import { modelRequest } from '../models/deadline.ts';

export interface SamImage { bytes: Uint8Array; width: number; height: number; signal?: AbortSignal; }
export interface PxBox { left: number; top: number; right: number; bottom: number; }
export interface SegmentResult { polygon: Polygon | null; confidence: number | null; latencyMs: number; }
type Events = AsyncIterable<{ readonly type: string }>;

/** Highest confidence wins (mask's own, else its box's); ties go to the larger area; null when there are no masks. */
export function pickPrimaryMask(records: readonly SegmentationRecord[]): { mask: SegmentationMaskRecord; confidence: number | null } | null {
  const boxes = new Map<string, SegmentationBoxRecord>(recordsOfKind(records, 'box').map((box) => [box.objectId, box]));
  let best: { mask: SegmentationMaskRecord; confidence: number | null } | null = null;
  let bestArea = -1;
  for (const mask of recordsOfKind(records, 'mask')) {
    const confidence = mask.confidence ?? boxes.get(mask.objectId)?.confidence ?? null;
    const area = (mask.bounds.right - mask.bounds.left) * (mask.bounds.bottom - mask.bounds.top);
    const score = confidence ?? -1;
    const bestScore = best?.confidence ?? -1;
    if (best === null || score > bestScore || (score === bestScore && area > bestArea)) {
      best = { mask, confidence };
      bestArea = area;
    }
  }
  return best;
}

/** Mask (raster local to its bounds) → simplified polygon in screen-normalized coordinates of the full image. */
export function maskToPolygon(m: SegmentationMaskRecord, imageW: number, imageH: number): Polygon | null {
  const raster = decodeMaskToRaster(m.mask);
  const polygon = simplifyPolygon(rasterToPolygon(raster, m.mask.width, m.mask.height));
  if (polygon.length < 3) return null;
  // The raster has its own size: SAM caps large objects (e.g. 281×1024 for a 345×1256 px box), so scale to bounds.
  const sx = (m.bounds.right - m.bounds.left) / m.mask.width, sy = (m.bounds.bottom - m.bounds.top) / m.mask.height;
  if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx <= 0 || sy <= 0) return null;
  return toUV(polygon.map((p) => ({ x: m.bounds.left + p.x * sx, y: m.bounds.top + p.y * sy })), imageW, imageH);
}

async function run(client: OpenAI, image: SamImage, text: string, events?: Events): Promise<SegmentResult> {
  const started = performance.now();
  const consume = async (stream: Events) => {
    const result = await parseImageStream(stream).finalResult;
    const primary = pickPrimaryMask(result.records);
    return { polygon: primary ? maskToPolygon(primary.mask, image.width, image.height) : null,
      confidence: primary?.confidence ?? null, latencyMs: Math.round(performance.now() - started) };
  };
  if (events) return consume(events);
  return modelRequest(client, image.signal, async (signal) => consume(await client.responses.create({
    model: MODELS.sam, stream: true,
    input: [{ role: 'user', content: [
      { type: 'input_text', text },
      { type: 'input_image', image_url: toDataUrl(image.bytes), detail: 'high' },
    ] }],
  }, { signal })));
}

/** Box prompt in image pixels. Coordinates are floored/clamped into the image so buildObjectPrompt never throws. */
export function segmentByBox(client: OpenAI, image: SamImage, box: PxBox, events?: Events): Promise<SegmentResult> {
  const left = Math.max(0, Math.min(image.width - 1, Math.floor(box.left)));
  const top = Math.max(0, Math.min(image.height - 1, Math.floor(box.top)));
  const right = Math.max(left + 1, Math.min(image.width, Math.ceil(box.right)));
  const bottom = Math.max(top + 1, Math.min(image.height, Math.ceil(box.bottom)));
  const text = buildObjectPrompt({ size: { width: image.width, height: image.height },
    objects: [{ id: 1, prompts: [{ box: { left, top, right, bottom } }] }] });
  return run(client, image, text, events);
}

/** Text concept prompt: a short noun phrase such as "touchscreen display", never a command or question. */
export function segmentByText(client: OpenAI, image: SamImage, phrase: string, events?: Events): Promise<SegmentResult> {
  if (!/^[\p{L}\p{N} '-]{1,60}$/u.test(phrase)) {
    throw new Error(`SAM noun phrase must be 1–60 letters/digits/spaces: "${phrase}"`);
  }
  return run(client, image, phrase, events);
}
