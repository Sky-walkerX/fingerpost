import type { LayoutElement, Locale } from '@fingerpost/protocol';
import { joinList, positionWords } from '../i18n/strings.ts';

/** "top left" … "bottom right", "middle" for the centre cell. Uses the polygon's vertex mean. */
export function describePosition(polygon: readonly { u: number; v: number }[], locale: Locale = 'en'): string {
  return positionWords(polygon, locale);
}

/** "Timer, Power and Start" — tappable labels only, at most `max`. */
export function listLabels(elements: readonly LayoutElement[], max = 5, locale: Locale = 'en'): string {
  return joinList(elements.filter((element) => element.role !== 'text').slice(0, Math.max(0, max)).map(({ label }) => label), 'and', locale);
}
