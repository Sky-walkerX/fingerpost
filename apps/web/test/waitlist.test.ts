import { expect, test, vi } from 'vitest';
import { submitWaitlist } from '../src/site/waitlist.ts';

test('signup sends the intended fields and only succeeds on confirmed storage', async () => {
  const fetcher = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
  await expect(submitWaitlist('https://example.test', { email: 'test@example.test', locale: 'hi', website: '' }, fetcher)).resolves.toBe('joined');
  expect(fetcher).toHaveBeenCalledWith('https://example.test/v1/waitlist', expect.objectContaining({ method: 'POST', body: '{"email":"test@example.test","locale":"hi","website":""}' }));
});

test('rate limits, rejected storage and network errors never show success', async () => {
  for (const status of [400, 429, 500]) {
    await expect(submitWaitlist('', { email: 'test@example.test', locale: 'en', website: '' }, async () => new Response('{}', { status }))).resolves.toBe(status === 429 ? 'limited' : 'failed');
  }
  await expect(submitWaitlist('', { email: 'test@example.test', locale: 'en', website: '' }, async () => { throw new Error('offline'); })).resolves.toBe('failed');
});
