import sharp from 'sharp';
import { LIMITS, type Polygon } from '@fingerpost/protocol';
import type { SamImage } from './sam.ts';

const MAX_PIXELS = 4 * 1024 * 1024;

/** Keep the caption and neighbouring button together, while returning all geometry in the source frame. */
export async function controlCrop(image: SamImage, polygon: Polygon): Promise<{ bytes: Buffer; toImage(points: Polygon): Polygon }> {
  image.signal?.throwIfAborted();
  const { width, height } = image;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_PIXELS
    || !polygon.length || polygon.some(({ u, v }) => !Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1)) throw new Error('Invalid control image');
  const left = Math.min(...polygon.map((p) => p.u)) * width, top = Math.min(...polygon.map((p) => p.v)) * height;
  const right = Math.max(...polygon.map((p) => p.u)) * width, bottom = Math.max(...polygon.map((p) => p.v)) * height;
  const w = right - left, h = bottom - top;
  if (w <= 0 || h <= 0) throw new Error('Invalid control bounds');
  const options = { limitInputPixels: MAX_PIXELS, failOn: 'error' as const, sequentialRead: true };
  const metadata = await sharp(image.bytes, options).metadata();
  const swapped = (metadata.orientation ?? 1) >= 5;
  if (metadata.format !== 'jpeg' || (swapped ? metadata.height : metadata.width) !== width
    || (swapped ? metadata.width : metadata.height) !== height) throw new Error('Invalid control image size');
  image.signal?.throwIfAborted();
  const x = Math.max(0, Math.floor(left - w)), y = Math.max(0, Math.floor(top - h));
  const cropW = Math.min(width, Math.ceil(right + w)) - x, cropH = Math.min(height, Math.ceil(bottom + h)) - y;
  const bytes = await sharp(image.bytes, options).autoOrient().extract({ left: x, top: y, width: cropW, height: cropH })
    .resize({ width: 1024, height: 1024, fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
  if (image.signal?.aborted || bytes.length > LIMITS.keyframeBytes) {
    bytes.fill(0);
    image.signal?.throwIfAborted();
    throw new Error('Control crop exceeds image bound');
  }
  return { bytes, toImage(points) {
    return points.map(({ u, v }) => ({ u: (x + u * cropW) / width, v: (y + v * cropH) / height }));
  } };
}
