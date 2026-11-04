import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { color, FPS, HEIGHT, WIDTH } from '../src/tokens.ts';

const web = readFileSync(new URL('../../web/index.html', import.meta.url), 'utf8');
const token = (name: string) => web.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))![1]!.toLowerCase();

test('colours equal the website tokens', () => {
  expect(color.ink.toLowerCase()).toBe(token('fg'));
  expect(color.blue.toLowerCase()).toBe(token('accent'));
  expect(color.panel.toLowerCase()).toBe(token('panel'));
  expect(color.peach.toLowerCase()).toBe(token('peach'));
  expect(color.night.toLowerCase()).toBe(token('night'));
  expect(color.nightText.toLowerCase()).toBe(token('night-text'));
});

test('the composition is 1920 x 1080 at 60 fps', () => {
  expect([WIDTH, HEIGHT, FPS]).toEqual([1920, 1080, 60]);
});
