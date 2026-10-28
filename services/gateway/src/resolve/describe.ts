import type { LayoutElement } from '@fingerpost/protocol';

/** "top left" … "bottom right", "middle" for the centre cell. Uses the polygon's vertex mean. */
export function describePosition(polygon: readonly { u: number; v: number }[]): string {
  const u = polygon.reduce((sum, p) => sum + p.u, 0) / polygon.length;
  const v = polygon.reduce((sum, p) => sum + p.v, 0) / polygon.length;
  const row = v < 1 / 3 ? 'top' : v > 2 / 3 ? 'bottom' : 'middle';
  const column = u < 1 / 3 ? 'left' : u > 2 / 3 ? 'right' : '';
  return column ? `${row} ${column}` : row;
}

/** "Timer, Power and Start" — tappable labels only, at most `max`. */
export function listLabels(elements: readonly LayoutElement[], max = 5): string {
  const labels = elements.filter((element) => element.role !== 'text').slice(0, Math.max(0, max)).map(({ label }) => label);
  return labels.length < 2 ? labels.join('') : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}
