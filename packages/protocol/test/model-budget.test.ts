import { expect, test } from 'vitest';
import { Ready } from '../src/server.ts';
const ready = { type: 'ready', id: 'synthetic', ts: 0, sessionId: 'synthetic', quota: { tasksLeft: 1 }, flags: { cloudEnabled: true, privateAvailable: false } };
test('ready preserves the optional bounded model wait and accepts older servers', () => {
  expect(Ready.parse({ ...ready, flags: { ...ready.flags, modelWaitMs: 65_000 } }).flags).toHaveProperty('modelWaitMs', 65_000);
  expect(Ready.parse(ready).flags).not.toHaveProperty('modelWaitMs');
});
test.each([0, -1, 5999, 65_001, 6500.5])('invalid model wait %i is refused', (modelWaitMs) => {
  expect(Ready.safeParse({ ...ready, flags: { ...ready.flags, modelWaitMs } }).success).toBe(false);
});
