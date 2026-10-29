import { expect, test } from 'vitest';
import { RevocationList } from '../src/auth/revocation.ts';

const respond = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

test('revoked and suspended serials are reported; leading zeros are normalized', async () => {
  const list = new RevocationList(respond({ entries: { '00ab12': { status: 'REVOKED' }, 'c0ffee': { status: 'SUSPENDED' } } }));
  await list.refresh();
  expect([list.isRevoked('ab12'), list.isRevoked('c0ffee'), list.isRevoked('1234')]).toEqual([true, true, false]);
});
test('fails closed before the first load and once the list is stale', async () => {
  let now = 0;
  const list = new RevocationList(respond({ entries: {} }), () => now, 1000);
  expect(() => list.isRevoked('ab')).toThrow();
  await list.refresh();
  expect(list.isRevoked('ab')).toBe(false);
  now = 1001;
  expect(() => list.isRevoked('ab')).toThrow();
});
test('an HTTP error keeps the previous list', async () => {
  let ok = true;
  const list = new RevocationList((async () => (ok ? new Response('{"entries":{"ab":{}}}') : new Response('', { status: 503 }))) as unknown as typeof fetch);
  await list.refresh();
  ok = false;
  await expect(list.refresh()).rejects.toThrow(/503/);
  expect(list.isRevoked('ab')).toBe(true);
});
