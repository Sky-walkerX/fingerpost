import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { expect, test } from 'vitest';

/** The landing page quotes the app's real spoken guidance, stays first-party and keeps the waitlist contract. */
const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const doc = new JSDOM(page).window.document;
const strings = readFileSync(new URL('../../android/core/guidance/src/main/kotlin/io/github/fingerpost/guidance/Strings.kt', import.meta.url), 'utf8');
const spoken = (key: string) => [...strings.matchAll(new RegExp(`Key\\.${key} to "([^"]+)"`, 'g'))].map((m) => m[1]!);

test('quoted guidance is the app\'s actual wording in English, Hindi and Spanish', () => {
  const [en, hi, es] = spoken('PRESS_NOW');
  expect(doc.querySelector('#hear-lines')!.textContent).toContain(en);
  const samples = [...doc.querySelectorAll<HTMLElement>('#languages [lang]')].map((n) => [n.lang, n.textContent!.trim()]);
  expect(samples).toEqual(expect.arrayContaining([['en', en], ['hi', hi], ['es', es]]));
  expect(doc.querySelector('#privacy')!.textContent).toContain(spoken('PIN_PAD_DETECTED')[0]);
});

test('no expired dates or unreleased claims on the page', () => {
  const text = doc.body.textContent!;
  expect(text).not.toMatch(/Beta target|November 2/);
  expect(text).not.toMatch(/\b\d{2,3}% (accurate|accuracy)\b/i);
});

test('the page loads nothing from third-party hosts (fonts and motion are bundled)', () => {
  for (const el of doc.querySelectorAll('script[src], link[href]')) {
    const ref = el.getAttribute('src') ?? el.getAttribute('href')!;
    expect(ref, ref).not.toMatch(/^(https?:)?\/\//);
  }
});

test('animated illustrations are hidden from screen readers or labelled as one image', () => {
  for (const id of ['tone', 'guided-demo', 'pinpad', 'pipeline']) {
    const el = doc.getElementById(id)!;
    expect(el, id).not.toBeNull();
    const hidden = el.getAttribute('aria-hidden') === 'true';
    const labelled = el.getAttribute('role') === 'img' && (el.getAttribute('aria-label') ?? '').length > 10;
    expect(hidden || labelled, id).toBe(true);
  }
});

test('the waitlist keeps the ids and closed default that main.ts relies on', () => {
  const form = doc.querySelector<HTMLFormElement>('form#waitlist')!;
  expect(doc.getElementById('waitlist-preview')!.getAttribute('role')).toBe('status');
  for (const id of ['email', 'locale', 'website']) expect(form.querySelector(`#${id}`), id).not.toBeNull();
  for (const control of form.querySelectorAll('input, select, button')) expect((control as HTMLInputElement).disabled).toBe(true);
  expect(doc.querySelector('a[href="https://github.com/Sky-walkerX/fingerpost/releases/latest"] img[src="/release-qr.png"]')).not.toBeNull();
});

test('the motion script honours reduced motion', () => {
  const script = readFileSync(new URL('../src/site/landing.ts', import.meta.url), 'utf8');
  expect(script).toContain('prefers-reduced-motion');
});
