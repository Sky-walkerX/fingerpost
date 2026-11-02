import { readFileSync } from 'node:fs';
import axe from 'axe-core';
import { JSDOM } from 'jsdom';
import { describe, expect, test } from 'vitest';
import config from '../vite.config.ts';

/** Days 4–7 plan, C5-2: every public page passes axe with 0 violations and reads well with a screen reader. */
const PAGES = ['index.html', 'privacy/index.html', 'data-safety/index.html', 'install/index.html'] as const;
const html = (page: string) => readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');

async function audit(page: string) {
  const dom = new JSDOM(html(page), { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://fingerpost.web.app/' });
  dom.window.eval(axe.source);
  const run = (dom.window as unknown as { axe: typeof axe }).axe.run;
  // jsdom has no layout, so axe can't measure contrast; the palette is checked below instead.
  const result = await run(dom.window.document, { rules: { 'color-contrast': { enabled: false } } });
  return { dom, violations: result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`) };
}

describe.each(PAGES)('%s', (page) => {
  test('axe: 0 violations', async () => {
    expect((await audit(page)).violations).toEqual([]);
  });

  test('one h1, a skip link, a lang and a title', async () => {
    const { dom } = await audit(page);
    const d = dom.window.document;
    expect(d.querySelectorAll('h1')).toHaveLength(1);
    expect(d.documentElement.lang).toBe('en');
    expect(d.title.length).toBeGreaterThan(5);
    expect(d.querySelector('a.skip[href="#main"]')).not.toBeNull();
    expect(d.getElementById('main')).not.toBeNull();
  });
});

test('every page is a build input, so it ships', () => {
  const input = (config as { build?: { rolldownOptions?: { input?: Record<string, string> } } }).build?.rolldownOptions?.input ?? {};
  for (const page of PAGES) expect(Object.values(input)).toContain(page);
});

test('the install guide is screen-reader-first: numbered steps and no visual-only directions', () => {
  const d = new JSDOM(html('install/index.html')).window.document;
  const steps = d.querySelectorAll('main ol > li');
  expect(steps.length).toBeGreaterThanOrEqual(6);
  const text = d.querySelector('main')!.textContent!.toLowerCase();
  for (const visual of ['click', 'blue', 'green', 'red button', 'top right', 'see the', 'look for the icon']) expect(text).not.toContain(visual);
  expect(text).toContain('talkback');
  expect(d.querySelector('a[href="https://github.com/Sky-walkerX/fingerpost/releases/latest"]')).not.toBeNull();
});

test('privacy and data-safety pages state the PIN, retention and no-training promises', () => {
  const privacy = new JSDOM(html('privacy/index.html')).window.document.querySelector('main')!.textContent!;
  for (const fact of ['PIN', 'never stored', '90 days', 'Standard mode', 'Clear saved screens', 'crash reporting']) expect(privacy).toContain(fact);
  const safety = new JSDOM(html('data-safety/index.html')).window.document;
  expect(safety.querySelectorAll('main table th[scope="col"]').length).toBeGreaterThanOrEqual(3);
  expect(safety.querySelector('main')!.textContent).toContain('Not collected');
});

test('every page links to the other public pages', () => {
  for (const page of PAGES) {
    const d = new JSDOM(html(page)).window.document;
    const hrefs = [...d.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    for (const target of ['/privacy/', '/data-safety/', '/install/']) expect(hrefs, page).toContain(target);
  }
});

// WCAG 2.1 AA contrast for the shared palette (normal text ≥ 4.5:1).
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

test.each(PAGES)('%s palette meets 4.5:1 contrast', (page) => {
  const vars = Object.fromEntries([...html(page).matchAll(/--(\w+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
  for (const [fg, bg] of [['fg', 'bg'], ['muted', 'bg'], ['accent', 'bg'], ['fg', 'panel'], ['muted', 'panel']] as const) {
    expect(ratio(vars[fg]!, vars[bg]!), `${page} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  }
});
