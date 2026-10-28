import { expect, test } from 'vitest';
import { jpegSize } from '../src/debug/jpeg.ts';

// Synthetic metadata only; this is not a photograph or a decodable image.
export function syntheticJpeg(width = 1024, height = 576, marker = 0xc0): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, marker, 0, 11, 8,
    height >> 8, height & 255, width >> 8, width & 255, 1, 1, 0x11, 0, 0xff, 0xd9]);
}

test.each([0xc0, 0xc2])('reads dimensions from synthetic SOF marker %i', (marker) => {
  expect(jpegSize(syntheticJpeg(1024, 576, marker))).toEqual({ width: 1024, height: 576 });
});

test('skips metadata segments and marker padding', () => {
  const image = syntheticJpeg();
  expect(jpegSize(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 4, 12, 34, 0xff, ...image.slice(2)])))
    .toEqual({ width: 1024, height: 576 });
});

test.each([
  new Uint8Array(), new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  syntheticJpeg().slice(0, 10), syntheticJpeg(0, 576), syntheticJpeg(1024, 0),
  new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 1]),
  new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 255, 255]),
  new Uint8Array([0xff, 0xd8, 0xff, 0xda, ...syntheticJpeg().slice(2)]),
])('rejects absent, truncated or invalid dimensions without echoing input', (bytes) => {
  expect(() => jpegSize(bytes)).toThrow('Invalid JPEG dimensions');
});
