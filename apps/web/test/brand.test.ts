import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

/** One brand across the site (and the Android app, see BrandThemeTest): same tokens, header, footer and icon on every public page. */
const read = (page: string) => readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
const tokens = (html: string) => Object.fromEntries([...html.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]!.toLowerCase()]));
const home = tokens(read('index.html'));

test.each(['privacy/index.html', 'install/index.html', 'data-safety/index.html'])('%s uses the landing tokens, header, footer and stylesheet', (page) => {
  const html = read(page);
  expect(tokens(html)).toEqual(home);
  expect(html).toContain('class="site-header"');
  expect(html).toContain('class="site-footer"');
  expect(html).toContain('href="/src/site/doc.css"');
  expect(html).toMatch(/aria-current="page"/);
});

test.each(['index.html', 'privacy/index.html', 'install/index.html', 'data-safety/index.html', 'public/404.html'])('%s links the brand favicon', (page) => {
  expect(read(page)).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
});

test('the raw 404 page carries the brand colours inline', () => {
  const html = read('public/404.html');
  for (const color of [home.fg, home.accent, home.muted]) expect(html.toLowerCase()).toContain(color);
});
