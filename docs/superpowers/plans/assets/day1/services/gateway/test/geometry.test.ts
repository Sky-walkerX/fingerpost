import { describe, expect, test } from 'vitest';
import { largestComponent, normalizeSparkBox, rasterToPolygon, simplifyPolygon, toUV, traceOuterContour } from '../src/parse/geometry.ts';

const raster = (w: number, h: number, fill: (x: number, y: number) => boolean) => {
  const r = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) r[y * w + x] = fill(x, y) ? 1 : 0;
  return r;
};
const bbox = (pts: { x: number; y: number }[]) => ({
  minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)),
  minY: Math.min(...pts.map((p) => p.y)), maxY: Math.max(...pts.map((p) => p.y)),
});
const area = (pts: { x: number; y: number }[]) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]!; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;

describe('normalizeSparkBox', () => {
  test('divides the 0–1000 grid by 1000', () => expect(normalizeSparkBox({ x_min: 100, y_min: 200, x_max: 400, y_max: 500 })).toEqual({ u: 0.1, v: 0.2, w: 0.3, h: 0.3 }));
  test('clamps overshoot and reorders swapped corners', () => expect(normalizeSparkBox({ x_min: 1010, y_min: 500, x_max: 900, y_max: -5 })).toEqual({ u: 0.9, v: 0, w: 0.1, h: 0.5 }));
  test('zero-size box stays zero-size', () => expect(normalizeSparkBox({ x_min: 300, y_min: 300, x_max: 300, y_max: 300 })).toEqual({ u: 0.3, v: 0.3, w: 0, h: 0 }));
});

describe('rasterToPolygon', () => {
  test('empty raster → []', () => expect(rasterToPolygon(new Uint8Array(400), 20, 20)).toEqual([]));
  test('single pixel → one point at its centre', () => expect(rasterToPolygon(raster(5, 5, (x, y) => x === 2 && y === 3), 5, 5)).toEqual([{ x: 2.5, y: 3.5 }]));
  test('filled 10×10 square: contour spans the square and simplifies to 4–8 points', () => {
    const pts = rasterToPolygon(raster(20, 20, (x, y) => x >= 5 && x < 15 && y >= 5 && y < 15), 20, 20);
    expect(bbox(pts)).toEqual({ minX: 5.5, maxX: 14.5, minY: 5.5, maxY: 14.5 });
    const s = simplifyPolygon(pts);
    expect(s.length).toBeGreaterThanOrEqual(4);
    expect(s.length).toBeLessThanOrEqual(8);
    expect(area(s)).toBeCloseTo(81, 0);
  });
  test('L-shape keeps its notch (area well below its bounding box)', () => {
    const pts = simplifyPolygon(rasterToPolygon(raster(30, 30, (x, y) => (x >= 2 && x < 12 && y >= 2 && y < 28) || (x >= 2 && x < 28 && y >= 18 && y < 28)), 30, 30));
    const b = bbox(pts);
    expect(area(pts)).toBeLessThan(0.7 * (b.maxX - b.minX) * (b.maxY - b.minY));
  });
  test('two blobs → only the bigger one is traced', () => {
    const r = raster(40, 20, (x, y) => (x >= 1 && x < 5 && y >= 1 && y < 5) || (x >= 20 && x < 38 && y >= 2 && y < 18));
    expect(bbox(rasterToPolygon(r, 40, 20))).toEqual({ minX: 20.5, maxX: 37.5, minY: 2.5, maxY: 17.5 });
  });
  test('ring (hollow square) → outer boundary only', () => {
    const r = raster(20, 20, (x, y) => x >= 2 && x < 18 && y >= 2 && y < 18 && !(x >= 6 && x < 14 && y >= 6 && y < 14));
    expect(bbox(rasterToPolygon(r, 20, 20))).toEqual({ minX: 2.5, maxX: 17.5, minY: 2.5, maxY: 17.5 });
  });
  test('one-pixel diagonal line terminates', () => {
    const pts = traceOuterContour(raster(10, 10, (x, y) => x === y), 10, 10);
    expect(pts.length).toBeGreaterThan(1);
    expect(pts.length).toBeLessThan(40);
  });
  test('largestComponent treats diagonal-only contact as separate (4-connectivity)', () => {
    const r = raster(4, 4, (x, y) => (x === 0 && y === 0) || (x === 1 && y === 1) || (x === 2 && y === 1));
    expect([...largestComponent(r, 4, 4)!].reduce((a, b) => a + b, 0)).toBe(2);
  });
});

describe('simplifyPolygon', () => {
  test('a 200 px circle simplifies to at most 32 points and keeps ≥ 95% of its area', () => {
    const r = raster(420, 420, (x, y) => (x - 210) ** 2 + (y - 210) ** 2 <= 200 ** 2);
    const s = simplifyPolygon(rasterToPolygon(r, 420, 420));
    expect(s.length).toBeLessThanOrEqual(32);
    expect(s.length).toBeGreaterThanOrEqual(8);
    expect(area(s)).toBeGreaterThan(0.95 * Math.PI * 200 ** 2);
  });
  test('respects a custom maxPoints', () => {
    const r = raster(200, 200, (x, y) => (x - 100) ** 2 + (y - 100) ** 2 <= 90 ** 2);
    expect(simplifyPolygon(rasterToPolygon(r, 200, 200), 12).length).toBeLessThanOrEqual(12);
  });
  test('3 or fewer points are returned unchanged', () => {
    const tri = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 5 }];
    expect(simplifyPolygon(tri)).toEqual(tri);
  });
});

test('toUV divides by image size and clamps', () => {
  expect(toUV([{ x: 640, y: 360 }, { x: -3, y: 800 }], 1280, 720)).toEqual([{ u: 0.5, v: 0.5 }, { u: 0, v: 1 }]);
});
