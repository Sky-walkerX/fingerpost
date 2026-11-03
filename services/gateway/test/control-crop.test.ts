import { expect, test } from 'vitest';
import sharp from 'sharp';
import { controlCrop } from '../src/parse/control-crop.ts';

const size = { width: 100, height: 80 };
const polygon = [{ u: .4, v: .4 }, { u: .6, v: .4 }, { u: .6, v: .6 }, { u: .4, v: .6 }];
const jpeg = () => sharp({ create: { ...size, channels: 3, background: '#284060' } }).jpeg().toBuffer();

test('context crop preserves the original image coordinate system after enlargement', async () => {
  const source = await jpeg(), copy = Buffer.from(source);
  const crop = await controlCrop({ bytes: source, ...size }, polygon);
  const metadata = await sharp(crop.bytes).metadata();
  expect(metadata.width).toBe(1024);
  expect(metadata.height).toBeLessThanOrEqual(1024);
  expect(metadata.exif).toBeUndefined();
  expect(source.equals(copy)).toBe(true);
  const mapped = crop.toImage([{ u: 0, v: 0 }, { u: 1, v: 1 }, { u: .5, v: .5 }]);
  expect(mapped[0]!.u).toBeCloseTo(.2);
  expect(mapped[0]!.v).toBeCloseTo(.2);
  expect(mapped[1]!.u).toBeCloseTo(.8);
  expect(mapped[1]!.v).toBeCloseTo(.8);
  expect(mapped[2]).toEqual({ u: .5, v: .5 });
});

test('an edge crop clamps to the image without padding or shifting its returned coordinates', async () => {
  const crop = await controlCrop({ bytes: await jpeg(), ...size }, [{ u: .01, v: .01 }, { u: .04, v: .01 }, { u: .04, v: .04 }]);
  expect(crop.toImage([{ u: 0, v: 0 }])).toEqual([{ u: 0, v: 0 }]);
});

test('a mismatched declared size cannot silently scale model coordinates', async () => {
  await expect(controlCrop({ bytes: await jpeg(), width: 101, height: 80 }, polygon)).rejects.toThrow();
});

test('malformed JPEGs and excessive declared pixels fail before any model call', async () => {
  await expect(controlCrop({ bytes: new Uint8Array([0xff, 0xd8]), ...size }, polygon)).rejects.toThrow();
  await expect(controlCrop({ bytes: await jpeg(), width: 4096, height: 4096 }, polygon)).rejects.toThrow();
});

test.each([
  { points: [{ u: NaN, v: .4 }, { u: .6, v: .6 }] },
  { points: [{ u: -.1, v: .4 }, { u: .6, v: .6 }] },
  { points: [{ u: .4, v: .4 }, { u: .4, v: .6 }] },
])('rejects invalid or collapsed coarse boxes', async ({ points }) => {
  await expect(controlCrop({ bytes: await jpeg(), ...size }, points)).rejects.toThrow();
});

test('already cancelled image work never prepares a crop', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(controlCrop({ bytes: await jpeg(), ...size, signal: controller.signal }, polygon)).rejects.toThrow();
});

test('EXIF orientation is normalized without retaining source metadata in the crop', async () => {
  const bytes = await sharp({ create: { ...size, channels: 3, background: '#406080' } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const crop = await controlCrop({ bytes, width: size.height, height: size.width }, polygon);
  const metadata = await sharp(crop.bytes).metadata();
  expect(metadata.exif).toBeUndefined();
  expect(metadata.orientation).toBeUndefined();
  expect(crop.toImage([{ u: .5, v: .5 }])[0]!.u).toBeCloseTo(.5);
});
