import type { Layout, LayoutElement, Locale } from '@fingerpost/protocol';

/**
 * Days 4–7 plan, B5-1 (design §3.2 Explore): what's on the screen, by region, with no model call.
 * Elements are grouped into top, middle and bottom thirds, then left and right, read top to bottom.
 * Each region is one sentence with at most 5 labels; the first answer is at most 3 sentences plus
 * "Say more for details.", and each "more" reads the next region.
 */
export const EXPLORE_PROMPT_ID = 'explore.v1';
const MAX_LABELS = 5;
const FIRST_SENTENCES = 3;

const WORDS: Record<Locale, { rows: [string, string, string]; left: string; right: string; and: string; more: string; end: string; stop: string; others: (n: number) => string }> = {
  en: { rows: ['At the top', 'In the middle', 'At the bottom'], left: 'left', right: 'right', and: 'and', stop: '.',
    more: 'Say more for details.', end: "That's everything on the screen.", others: (n) => `${n} more` },
  hi: { rows: ['ऊपर', 'बीच में', 'नीचे'], left: 'बाईं ओर', right: 'दाईं ओर', and: 'और', stop: '।',
    more: 'और जानने के लिए "और" कहें।', end: 'स्क्रीन पर बस इतना ही है।', others: (n) => `${n} और` },
  es: { rows: ['Arriba', 'En el medio', 'Abajo'], left: 'a la izquierda', right: 'a la derecha', and: 'y', stop: '.',
    more: 'Di más para más detalles.', end: 'Eso es todo en la pantalla.', others: (n) => `${n} más` },
};
export const MORE_PROMPT: Record<Locale, string> = { en: WORDS.en.more, hi: WORDS.hi.more, es: WORDS.es.more };

const centre = (el: LayoutElement) => ({
  u: el.polygon.reduce((s, p) => s + p.u, 0) / el.polygon.length,
  v: el.polygon.reduce((s, p) => s + p.v, 0) / el.polygon.length,
});

function list(labels: string[], w: (typeof WORDS)[Locale]): string {
  const shown = labels.slice(0, MAX_LABELS);
  const rest = labels.length - shown.length;
  const items = rest > 0 ? [...shown, w.others(rest)] : shown;
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${w.and} ${items.at(-1)}`;
}

export function summarize(layout: Pick<Layout, 'elements'>, locale: Locale): { regions: string[] } {
  const w = WORDS[locale];
  const cells = new Map<string, { row: number; side: 0 | 1; items: { el: LayoutElement; u: number; v: number }[] }>();
  for (const el of layout.elements) {
    const label = el.label.trim();
    if (!label) continue;
    const c = centre(el);
    const row = Math.min(2, Math.max(0, Math.floor(c.v * 3)));
    const side: 0 | 1 = c.u < 0.5 ? 0 : 1;
    const key = `${row}${side}`;
    const cell = cells.get(key) ?? { row, side, items: [] };
    cell.items.push({ el, ...c });
    cells.set(key, cell);
  }
  const regions = [...cells.values()].sort((a, b) => a.row - b.row || a.side - b.side).map((cell) => {
    const labels = cell.items.sort((a, b) => a.v - b.v || a.u - b.u).map(({ el }) => el.labelLocal?.trim() || el.label.trim());
    return `${w.rows[cell.row]} ${cell.side === 0 ? w.left : w.right}: ${list(labels, w)}${w.stop}`;
  });
  return { regions };
}

/** The first answer: up to three regions, then the prompt to ask for more. */
export function firstSay(regions: string[], locale: Locale): string {
  return [...regions.slice(0, FIRST_SENTENCES), WORDS[locale].more].join(' ');
}

/** The region at [cursor], or the closing line when every region was read. */
export function nextSay(regions: string[], cursor: number, locale: Locale): { text: string; cursor: number } {
  if (cursor >= regions.length) return { text: WORDS[locale].end, cursor: regions.length };
  return { text: regions[cursor]!, cursor: cursor + 1 };
}

const MORE = new Set(['more', 'tell me more', 'more please', 'say more', 'más', 'mas', 'और', 'aur']);
/** "more" / "más" / "और" while an explore summary is open. */
export const isMore = (text: string) => MORE.has(text.trim().toLowerCase().replace(/[.!?।]+$/u, ''));
