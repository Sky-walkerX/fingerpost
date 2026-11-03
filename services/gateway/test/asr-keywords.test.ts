import { expect, test } from 'vitest';
import { handshake } from '../src/asr/relay.ts';

const options = (keywords: string[]) => ({ apiKey: 'synthetic-key', locales: ['en' as const], keywords });

test('oversized and blank keyword labels cannot reject the entire recognition handshake', () => {
  const keywords = [' Synthetic control ', 'x'.repeat(30), 'x'.repeat(31), '', '   '];
  expect(handshake(options(keywords)).keywords).toEqual(['Synthetic control', 'x'.repeat(30)]);
  expect(keywords[0]).toBe(' Synthetic control ');
});

test('the keyword limit counts Unicode characters without splitting supplementary letters', () => {
  const short = '𝒜'.repeat(30), long = '𝒜'.repeat(31);
  expect(handshake(options([short, long])).keywords).toEqual([short]);
});

test('discard invalid keywords before selecting the first 50 useful hints', () => {
  const keywords = [...Array.from({ length: 50 }, () => 'x'.repeat(31)), 'Synthetic control'];
  expect(handshake(options(keywords)).keywords).toEqual(['Synthetic control']);
});
