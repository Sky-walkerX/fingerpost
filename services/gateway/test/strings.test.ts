import { expect, test } from 'vitest';
import type { ErrorCode } from '@fingerpost/protocol';
import { joinList, positionWords, spokenError, STRINGS, t, type StringKey } from '../src/i18n/strings.ts';
import { SPOKEN_ERRORS } from '../src/errors/spoken.ts';

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('every key has en, hi, es with the same {vars}', () => {
  const keys = Object.keys(STRINGS.en) as StringKey[];
  expect(keys.length).toBeGreaterThan(20);
  for (const locale of ['hi', 'es'] as const) {
    expect(Object.keys(STRINGS[locale]).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(STRINGS[locale][key].trim(), `${locale}.${key}`).not.toBe('');
      expect(vars(STRINGS[locale][key]), `${locale}.${key}`).toEqual(vars(STRINGS.en[key]));
    }
  }
});

test('t fills variables and leaves English unchanged', () => {
  expect(t('en', 'found', { label: 'Start', position: 'bottom right' })).toBe('Found Start, bottom right.');
  expect(t('hi', 'found', { label: 'Start', position: 'नीचे दाईं ओर' })).toBe('Start मिला, नीचे दाईं ओर।');
  expect(t('es', 'verify_done')).toBe('Hecho.');
});

test('positions and lists match the phone (core:guidance OfflinePhrases)', () => {
  const box = (u: number, v: number) => [{ u, v }, { u: u + 0.2, v }, { u: u + 0.2, v: v + 0.1 }, { u, v: v + 0.1 }];
  expect(positionWords(box(0.7, 0.8), 'en')).toBe('bottom right');
  expect(positionWords(box(0.7, 0.8), 'hi')).toBe('नीचे दाईं ओर');
  expect(positionWords(box(0.7, 0.8), 'es')).toBe('abajo, a la derecha');
  expect(positionWords(box(0.4, 0.45), 'es')).toBe('en el centro');
  expect(joinList(['Timer', 'Power', 'Start'], 'and', 'hi')).toBe('Timer, Power और Start');
  expect(joinList(['Small', 'Large'], 'or', 'es')).toBe('Small o Large');
  expect(joinList(['Start'], 'and', 'en')).toBe('Start');
});

test('spoken errors exist in every locale and English matches SPOKEN_ERRORS', () => {
  for (const code of Object.keys(SPOKEN_ERRORS) as ErrorCode[]) {
    expect(spokenError(code, 'en')).toEqual(SPOKEN_ERRORS[code]);
    for (const locale of ['hi', 'es'] as const) {
      expect(spokenError(code, locale).retryable).toBe(SPOKEN_ERRORS[code].retryable);
      expect(spokenError(code, locale).say).not.toBe(SPOKEN_ERRORS[code].say);
    }
  }
});
