import { expect, test } from 'vitest';
import { satisfiesMinimum } from '../src/min-version/version.ts';

test.each([
  ['1.2.3', '1.2.3', true], ['1.10.0', '1.2.9', true], ['1.0.9', '1.1.0', false],
  ['1.0.0-rc1', '1.0.0', false], ['1.0.0', '1.0.0-rc1', true],
  ['1.0.0-rc.10', '1.0.0-rc.2', true], ['1.0.0-beta', '1.0.0-alpha', true],
  ['1.0.0-alpha', '1.0.0-alpha.1', false], ['1.0.0+build.1', '1.0.0', true],
  ['bad', '0.1.0', false], ['01.0.0', '0.1.0', false], ['1.0.0-01', '1.0.0', false],
  ['2147483648.0.0', '1.0.0', false], ['1.0.0', 'invalid', false],
] as const)('%s meets %s: %s', (current, minimum, expected) => expect(satisfiesMinimum(current, minimum)).toBe(expected));
