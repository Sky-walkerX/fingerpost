import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { appQuote } from '../src/copy.ts';

const strings = readFileSync(new URL('../../android/core/guidance/src/main/kotlin/io/github/fingerpost/guidance/Strings.kt', import.meta.url), 'utf8');
const english = (key: string) => strings.match(new RegExp(`Key\\.${key} to "([^"]+)"`))![1];

test("app quotes are the app's exact English strings", () => {
  expect(appQuote.pressNow).toBe(english('PRESS_NOW'));
  expect(appQuote.sayYesToPay).toBe(english('SAY_YES_OR_NO'));
  expect(appQuote.done).toBe(english('DONE'));
  expect(appQuote.pinPad).toBe(english('PIN_PAD_DETECTED'));
  expect(appQuote.overcharge).toBe(english('OVERCHARGE_WARNING'));
});

test('src has no nondeterminism', () => {
  const root = fileURLToPath(new URL('../src', import.meta.url));
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
  for (const file of files(root)) {
    const text = readFileSync(file, 'utf8');
    for (const bad of ['Math.random', 'Date.now', 'new Date', 'fetch(']) expect(text, `${file}: ${bad}`).not.toContain(bad);
  }
});
