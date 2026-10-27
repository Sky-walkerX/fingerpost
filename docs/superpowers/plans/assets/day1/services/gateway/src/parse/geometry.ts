export interface Pt { x: number; y: number; }
export interface NormBox { u: number; v: number; w: number; h: number; }
export interface SparkBox { x_min: number; y_min: number; x_max: number; y_max: number; }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Spark grounding uses a 0–1000 grid and may overshoot or swap corners. Never throws. */
export function normalizeSparkBox(b: SparkBox): NormBox {
  const xs = [clamp(b.x_min, 0, 1000), clamp(b.x_max, 0, 1000)].sort((a, c) => a - c) as [number, number];
  const ys = [clamp(b.y_min, 0, 1000), clamp(b.y_max, 0, 1000)].sort((a, c) => a - c) as [number, number];
  const r = (n: number) => Math.round(n * 1e6) / 1e6;
  return { u: r(xs[0] / 1000), v: r(ys[0] / 1000), w: r((xs[1] - xs[0]) / 1000), h: r((ys[1] - ys[0]) / 1000) };
}

/** Keep only the largest 4-connected component of a 0/1 raster. Returns null when the raster is empty. */
export function largestComponent(raster: Uint8Array, w: number, h: number): Uint8Array | null {
  const label = new Int32Array(w * h);
  let best = 0, bestSize = 0, next = 0;
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (raster[i] !== 1 || label[i] !== 0) continue;
    next++; let size = 0; stack.push(i); label[i] = next;
    while (stack.length) {
      const j = stack.pop()!; size++;
      const x = j % w, y = (j - x) / w;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx;
        if (raster[k] === 1 && label[k] === 0) { label[k] = next; stack.push(k); }
      }
    }
    if (size > bestSize) { bestSize = size; best = next; }
  }
  if (best === 0) return null;
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = label[i] === best ? 1 : 0;
  return out;
}

// 8-neighbourhood, clockwise in image coordinates (y down), starting at West.
const N8 = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]] as const;

/** Moore-neighbour tracing of the outer boundary, with Jacob's stopping criterion. Pixel coordinates. */
export function traceOuterContour(mask: Uint8Array, w: number, h: number): Pt[] {
  const start = mask.indexOf(1);
  if (start < 0) return [];
  const sx = start % w, sy = (start - sx) / w;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const out: Pt[] = [{ x: sx, y: sy }];
  let cx = sx, cy = sy, back = 0; // came "from" West, which is background for the first pixel in scan order
  let firstMove = -1;
  for (let guard = 0; guard < 8 * w * h + 16; guard++) {
    let found = -1;
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8;
      if (on(cx + N8[d]![0], cy + N8[d]![1])) { found = d; break; }
    }
    if (found < 0) return out; // isolated pixel
    if (cx === sx && cy === sy) {
      if (firstMove === found) break; // re-entering the start the same way: done
      if (firstMove < 0) firstMove = found;
    }
    const nx = cx + N8[found]![0], ny = cy + N8[found]![1];
    const p = (found + 7) % 8; // the background neighbour checked just before `found`
    const bx = cx + N8[p]![0] - nx, by = cy + N8[p]![1] - ny;
    back = N8.findIndex(([ax, ay]) => ax === bx && ay === by);
    cx = nx; cy = ny;
    if (!(cx === sx && cy === sy)) out.push({ x: cx, y: cy });
  }
  return out;
}

/** Outer contour of the largest component, as pixel-centre points. [] for an empty raster. */
export function rasterToPolygon(raster: Uint8Array, w: number, h: number): Pt[] {
  const comp = largestComponent(raster, w, h);
  if (!comp) return [];
  return traceOuterContour(comp, w, h).map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
}

function perpDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

function dpOpen(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = perpDist(pts[i]!, pts[0]!, pts[pts.length - 1]!); if (d > maxD) { maxD = d; idx = i; } }
  if (maxD <= eps) return [pts[0]!, pts[pts.length - 1]!];
  const left = dpOpen(pts.slice(0, idx + 1), eps);
  return [...left.slice(0, -1), ...dpOpen(pts.slice(idx), eps)];
}

/** Douglas–Peucker on a closed ring. ε starts at 0.5 px and doubles until ≤ maxPoints. Never below 3 points. */
export function simplifyPolygon(pts: Pt[], maxPoints = 32): Pt[] {
  if (pts.length <= 3) return pts;
  // split the ring at the point farthest from pts[0] and simplify both halves
  let far = 1, farD = -1;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i]!.x - pts[0]!.x, pts[i]!.y - pts[0]!.y); if (d > farD) { farD = d; far = i; } }
  let eps = 0.5;
  let last = pts;
  for (let iter = 0; iter < 40; iter++) {
    const a = dpOpen(pts.slice(0, far + 1), eps);
    const b = dpOpen([...pts.slice(far), pts[0]!], eps);
    const ring = [...a.slice(0, -1), ...b.slice(0, -1)];
    if (ring.length < 3) break; // ε too coarse for this shape; keep the last good ring
    last = ring;
    if (ring.length <= maxPoints) return ring;
    eps *= 2;
  }
  if (last.length <= maxPoints) return last;
  const step = Math.ceil(last.length / maxPoints);
  return last.filter((_, i) => i % step === 0);
}

/** Pixel polygon (in the full image) → screen-normalized polygon, clamped to [0,1]. */
export function toUV(pts: Pt[], width: number, height: number): Array<{ u: number; v: number }> {
  const r = (n: number) => Math.round(n * 1e6) / 1e6;
  return pts.map((p) => ({ u: r(clamp(p.x / width, 0, 1)), v: r(clamp(p.y / height, 0, 1)) }));
}
