import { LIMITS } from './common.ts';

export type DecodeError = 'short' | 'header_too_large' | 'header_not_utf8' | 'header_not_json';
export type DecodedFrame = { ok: true; header: unknown; payload: Uint8Array } | { ok: false; error: DecodeError };

/** Layout: [u32 big-endian headerLen][UTF-8 JSON header][payload]. */
export function encodeFrame(header: object, payload: Uint8Array): Uint8Array {
  throw new Error('TODO(D1-T2): implement this; the tests describe the behaviour');
}

export function decodeFrame(buf: Uint8Array): DecodedFrame {
  throw new Error('TODO(D1-T2): implement this; the tests describe the behaviour');
}
