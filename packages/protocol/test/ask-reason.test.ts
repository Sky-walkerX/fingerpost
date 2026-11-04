import { expect, test } from 'vitest';
import { Ask } from '../src/server.ts';

const ask = { type: 'ask', id: 'synthetic-ask', ts: 1, question: "I can't find the screen.", options: [] };

test('an ask may mark itself as a reframe request; older asks without a reason stay valid', () => {
  expect(Ask.parse({ ...ask, reason: 'reframe' }).reason).toBe('reframe');
  expect(Ask.parse(ask).reason).toBeUndefined();
});

test('an unknown ask reason is rejected', () => {
  expect(Ask.safeParse({ ...ask, reason: 'retry-forever' }).success).toBe(false);
});
