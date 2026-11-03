import { expect, test } from 'vitest';
import type { Polygon } from '@fingerpost/protocol';
import { fullFrameCoordinates } from '../src/session/screen-coordinates.ts';
import { coversApplianceControls } from '../src/session/geometry-quality.ts';

const size = { w: 1000, h: 800 };
const rounded: Polygon = [
  { u: .12, v: .125 }, { u: .88, v: .125 }, { u: .9, v: .15 }, { u: .9, v: .85 },
  { u: .88, v: .875 }, { u: .12, v: .875 }, { u: .1, v: .85 }, { u: .1, v: .15 },
];

test('a rounded panel produces an enclosing plane instead of cutting off alternating corners', () => {
  const space = fullFrameCoordinates(size, rounded, undefined, 0)!;
  expect(space.screenQuad).toEqual([{ x: 100, y: 100 }, { x: 900, y: 100 }, { x: 900, y: 700 }, { x: 100, y: 700 }]);
});

test('controls near the side of a rounded panel remain inside its actual surface plane', () => {
  const control = { id: 'synthetic-control', label: 'Synthetic', role: 'button' as const, confidence: .95,
    polygon: [{ u: .102, v: .23 }, { u: .118, v: .23 }, { u: .118, v: .27 }, { u: .102, v: .27 }] };
  const space = fullFrameCoordinates(size, rounded, undefined, 0);
  expect(coversApplianceControls(space, size, [control], control)).toBe(true);
});

test('perspective edges stay perspective edges when their corners are already explicit', () => {
  const corners: Polygon = [{ u: .15, v: .2 }, { u: .8, v: .1 }, { u: .9, v: .8 }, { u: .1, v: .9 }];
  expect(fullFrameCoordinates(size, corners, undefined, 0)?.screenQuad)
    .toEqual(corners.map(({ u, v }) => ({ x: u * size.w, y: v * size.h })));
});

test('a clipped surface cannot acquire corners extrapolated outside the captured image', () => {
  const clipped: Polygon = [{ u: .4, v: 0 }, { u: .6, v: 0 }, { u: 1, v: .4 }, { u: 1, v: .6 },
    { u: .6, v: 1 }, { u: .4, v: 1 }, { u: 0, v: .6 }, { u: 0, v: .4 }];
  expect(fullFrameCoordinates(size, clipped, undefined, 0)).toBeNull();
});
