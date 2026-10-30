import type { Point, Polygon } from '@fingerpost/protocol';

export interface ScreenCoordinates {
  screenQuad: Point[];
  toScreen(polygon: Polygon): Polygon | null;
}

/** A full image's model polygons must use the same screen plane as the phone's homography. */
export function fullFrameCoordinates(size: { w: number; h: number }, mask: Polygon | null,
  hint: Point[] | undefined, rotation: 0 | 90 | 180 | 270): ScreenCoordinates | null {
  const fromMask = mask ? quadOf(mask.map(({ u, v }) => ({ x: u * size.w, y: v * size.h }))) : null;
  const fallback = hint?.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)
    && p.x >= 0 && p.x <= size.w && p.y >= 0 && p.y <= size.h) ? quadOf(hint) : null;
  const geometric = fromMask ?? fallback;
  if (!geometric) return null;
  const screenQuad = geometric.map((_, i) => geometric[(i + rotation / 90) % 4]!);
  const map = homography(screenQuad);
  if (!map) return null;
  return { screenQuad, toScreen(polygon) {
    const mapped = polygon.map(({ u, v }) => map({ x: u * size.w, y: v * size.h }));
    if (mapped.some((p) => p === null)) return null;
    const points = mapped.filter((p): p is Point => p !== null);
    const centre = { x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length };
    if (centre.x < -EPS || centre.x > 1 + EPS || centre.y < -EPS || centre.y > 1 + EPS) return null;
    let clipped = points;
    for (const [axis, edge, sign] of [['x', 0, 1], ['x', 1, -1], ['y', 0, 1], ['y', 1, -1]] as const) {
      const output: Point[] = [];
      for (let i = 0; i < clipped.length; i++) {
        const a = clipped[(i + clipped.length - 1) % clipped.length]!, b = clipped[i]!;
        const insideA = sign * (a[axis] - edge) >= -EPS, insideB = sign * (b[axis] - edge) >= -EPS;
        if (insideA !== insideB) {
          const t = (edge - a[axis]) / (b[axis] - a[axis]);
          output.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
        }
        if (insideB) output.push(b);
      }
      clipped = output;
    }
    const round = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1e6) / 1e6;
    const unique = clipped.map((p) => ({ x: round(p.x), y: round(p.y) }))
      .filter((p, i, all) => !all.slice(0, i).some((other) => p.x === other.x && p.y === other.y));
    if (unique.length < 3 || unique.length > 32 || area(unique) <= EPS) return null;
    return unique.map(({ x: u, y: v }) => ({ u, v }));
  } };
}

const EPS = 1e-9;
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const area = (points: Point[]) => Math.abs(points.reduce((sum, p, i) => {
  const next = points[(i + 1) % points.length]!; return sum + p.x * next.y - next.x * p.y;
}, 0)) / 2;

/** Largest inscribed quadrilateral of the convex mask; model polygons have at most 32 points. */
function quadOf(points: Point[]): Point[] | null {
  if (points.length < 4 || points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y), lower: Point[] = [], upper: Point[] = [];
  for (const chain of [sorted, [...sorted].reverse()]) {
    const half = chain === sorted ? lower : upper;
    for (const p of chain) {
      while (half.length >= 2 && cross(half.at(-2)!, half.at(-1)!, p) <= EPS) half.pop();
      half.push(p);
    }
    half.pop();
  }
  const hull = [...lower, ...upper];
  if (hull.length < 4) return null;
  let best: Point[] | null = null, bestArea = EPS;
  for (let a = 0; a < hull.length - 3; a++) for (let b = a + 1; b < hull.length - 2; b++)
    for (let c = b + 1; c < hull.length - 1; c++) for (let d = c + 1; d < hull.length; d++) {
      const candidate = [hull[a]!, hull[b]!, hull[c]!, hull[d]!], value = area(candidate);
      if (value > bestArea) { bestArea = value; best = candidate; }
    }
  if (!best) return null;
  const quad = best;
  let start = 0;
  for (let i = 1; i < 4; i++) if (quad[i]!.x + quad[i]!.y < quad[start]!.x + quad[start]!.y) start = i;
  return quad.map((_, i) => quad[(start + i) % 4]!);
}

/** DLT with h33=1 and partial-pivot elimination, matching the device's pure Kotlin transform. */
function homography(quad: Point[]): ((p: Point) => Point | null) | null {
  const unit = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  const rows = quad.flatMap(({ x, y }, i) => {
    const { x: u, y: v } = unit[i]!;
    return [[x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]];
  });
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++) if (Math.abs(rows[row]![col]!) > Math.abs(rows[pivot]![col]!)) pivot = row;
    if (Math.abs(rows[pivot]![col]!) < EPS) return null;
    [rows[col], rows[pivot]] = [rows[pivot]!, rows[col]!];
    for (let row = 0; row < 8; row++) if (row !== col) {
      const factor = rows[row]![col]! / rows[col]![col]!;
      for (let c = col; c <= 8; c++) rows[row]![c] = rows[row]![c]! - factor * rows[col]![c]!;
    }
  }
  const h = rows.map((row, i) => row[8]! / row[i]!);
  return ({ x, y }) => {
    const w = h[6]! * x + h[7]! * y + 1;
    if (Math.abs(w) < EPS) return null;
    const point = { x: (h[0]! * x + h[1]! * y + h[2]!) / w, y: (h[3]! * x + h[4]! * y + h[5]!) / w };
    return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
  };
}
