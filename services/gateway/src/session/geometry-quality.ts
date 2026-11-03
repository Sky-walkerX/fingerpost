import type { LayoutElement, Polygon } from '@fingerpost/protocol';
import type { ScreenCoordinates } from './screen-coordinates.ts';

const signedArea = (p: Polygon) => p.reduce((sum, a, i) => {
  const b = p[(i + 1) % p.length]!;
  return sum + a.u * b.v - b.u * a.v;
}, 0) / 2;
const area = (p: Polygon) => Math.abs(signedArea(p));

/** Clip against a convex boundary; unlike bounding-box overlap this preserves perspective. */
function intersection(subject: Polygon, boundary: Polygon): Polygon {
  let output = subject;
  const winding = Math.sign(signedArea(boundary));
  for (let i = 0; i < boundary.length && output.length; i++) {
    const a = boundary[i]!, b = boundary[(i + 1) % boundary.length]!;
    const side = (p: Polygon[number]) => winding * ((b.u - a.u) * (p.v - a.v) - (b.v - a.v) * (p.u - a.u));
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[(j + input.length - 1) % input.length]!, q = input[j]!;
      const sp = side(p), sq = side(q);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        output.push({ u: p.u + t * (q.u - p.u), v: p.v + t * (q.v - p.v) });
      }
      if (sq >= 0) output.push(q);
    }
  }
  return output;
}

/** guidance-spec §4: an icon stroke, another button or the panel itself is not a refinement. */
export function usableRefinement(box: Polygon, mask: Polygon | null): Polygon | null {
  if (!mask) return null;
  const boxArea = area(box), maskArea = area(mask);
  if (!boxArea || !maskArea || !Number.isFinite(maskArea)) return null;
  const ratio = maskArea / boxArea;
  return ratio >= 0.5 && ratio <= 1.25 && area(intersection(mask, box)) / maskArea >= 0.8 ? mask : null;
}

/** A small appliance LCD must not discard the touch controls around it. */
export function coversApplianceControls(space: ScreenCoordinates | null, size: { w: number; h: number },
  elements: readonly LayoutElement[], required?: LayoutElement): boolean {
  if (!space) return false;
  const plane = space.screenQuad.map(({ x, y }) => ({ u: x / size.w, v: y / size.h }));
  const covered = (element: LayoutElement) => {
    const total = area(element.polygon);
    return total > 0 && area(intersection(element.polygon, plane)) / total >= 0.8;
  };
  const controls = elements.filter((e) => e.role !== 'text');
  return (!required || covered(required)) && (!controls.length || controls.filter(covered).length / controls.length >= 0.8);
}
