import { LIMITS } from './common.ts';

export type DecodeError = 'short' | 'header_too_large' | 'header_not_utf8' | 'header_not_json';
export type DecodedFrame = { ok: true; header: unknown; payload: Uint8Array } | { ok: false; error: DecodeError };

/** Layout: [u32 big-endian headerLen][UTF-8 JSON header][payload]. */
export function encodeFrame(header: object, payload: Uint8Array): Uint8Array {
  const bytes = new TextEncoder().encode(JSON.stringify(header));
  const frame = new Uint8Array(4 + bytes.length + payload.length);
  new DataView(frame.buffer).setUint32(0, bytes.length, false);
  frame.set(bytes, 4);
  frame.set(payload, 4 + bytes.length);
  return frame;
}

export function decodeFrame(buf: Uint8Array): DecodedFrame {
  if (buf.length < 4) return { ok: false, error: 'short' };
  const length = new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(0, false);
  if (length > LIMITS.headerBytes) return { ok: false, error: 'header_too_large' };
  if (buf.length < 4 + length) return { ok: false, error: 'short' };
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf.subarray(4, 4 + length));
  } catch {
    return { ok: false, error: 'header_not_utf8' };
  }
  try {
    return { ok: true, header: JSON.parse(text), payload: buf.subarray(4 + length) };
  } catch {
    return { ok: false, error: 'header_not_json' };
  }
}
