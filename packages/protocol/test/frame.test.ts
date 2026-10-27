import { expect, test } from 'vitest';
import { decodeFrame, encodeFrame, LIMITS } from '@fingerpost/protocol';

const u32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, false); return b; };
const concat = (...parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

test('round-trips header and payload', () => {
  const header = { type: 'keyframe', id: 'a', ts: 1 };
  const d = decodeFrame(encodeFrame(header, new Uint8Array([1, 2, 3])));
  expect(d).toEqual({ ok: true, header, payload: new Uint8Array([1, 2, 3]) });
});
test('empty payload is allowed', () => {
  const d = decodeFrame(encodeFrame({ type: 'audio.end' }, new Uint8Array()));
  expect(d.ok && d.payload.length).toBe(0);
});
test('header length is big-endian', () => {
  const f = encodeFrame({ a: 1 }, new Uint8Array());
  expect([...f.subarray(0, 4)]).toEqual([0, 0, 0, 7]); // {"a":1} is 7 bytes
});
test('buffer shorter than 4 bytes → short', () => expect(decodeFrame(new Uint8Array([0, 0]))).toEqual({ ok: false, error: 'short' }));
test('headerLen larger than the buffer → short', () => expect(decodeFrame(concat(u32(10), new Uint8Array([123])))).toEqual({ ok: false, error: 'short' }));
test(`headerLen over ${LIMITS.headerBytes} → header_too_large`, () => expect(decodeFrame(u32(LIMITS.headerBytes + 1))).toEqual({ ok: false, error: 'header_too_large' }));
test('invalid UTF-8 header → header_not_utf8', () => expect(decodeFrame(concat(u32(2), new Uint8Array([0xff, 0xfe])))).toEqual({ ok: false, error: 'header_not_utf8' }));
test('UTF-8 that is not JSON → header_not_json', () => expect(decodeFrame(concat(u32(3), new TextEncoder().encode('abc')))).toEqual({ ok: false, error: 'header_not_json' }));
test('works on a subarray with a non-zero byteOffset', () => {
  const f = encodeFrame({ t: 1 }, new Uint8Array([9]));
  const padded = concat(new Uint8Array([7, 7, 7]), f).subarray(3);
  expect(decodeFrame(padded)).toEqual({ ok: true, header: { t: 1 }, payload: new Uint8Array([9]) });
});
