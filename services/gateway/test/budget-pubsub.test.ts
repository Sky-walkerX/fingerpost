import { expect, test, vi } from 'vitest';
import { pubsubBudgetPort } from '../src/budget/pubsub.ts';

const subscription = 'projects/synthetic-project/subscriptions/budget-stop';
const delivery = { ackId: 'synthetic-ack', message: { messageId: 'synthetic-message', publishTime: '2026-11-02T00:00:00Z',
  data: 'e30=', attributes: { schemaVersion: '1.0' } } };

test('pull and acknowledge use the fixed authenticated Pub/Sub resource, with redirects and retries disabled', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ receivedMessages: [delivery] })));
  const port = pubsubBudgetPort(subscription, async () => 'synthetic-token', fetch);
  const signal = new AbortController().signal;
  expect(await port.pull(signal)).toEqual([delivery]); await port.acknowledge(['synthetic-ack'], signal);
  expect(fetch.mock.calls.map(c => c[0])).toEqual([`https://pubsub.googleapis.com/v1/${subscription}:pull`,
    `https://pubsub.googleapis.com/v1/${subscription}:acknowledge`]);
  expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body))).toEqual({ maxMessages: 10 });
  expect(JSON.parse(String(fetch.mock.calls[1]![1]!.body))).toEqual({ ackIds: ['synthetic-ack'] });
  for (const [, options] of fetch.mock.calls) {
    expect(options?.redirect).toBe('error'); expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.headers).toEqual({ authorization: 'Bearer synthetic-token', 'content-type': 'application/json' });
  }
});

test('untrusted resource names, missing credentials, failed HTTP and malformed/oversized responses fail safely', async () => {
  for (const resource of ['https://example.invalid', 'projects/p/subscriptions/x', subscription + '%2F..', subscription + '?x=1'])
    expect(() => pubsubBudgetPort(resource, async () => 't')).toThrow('Invalid budget subscription');
  const signal = new AbortController().signal;
  const absent = vi.fn<typeof globalThis.fetch>();
  await expect(pubsubBudgetPort(subscription, async () => '', absent).pull(signal)).rejects.toThrow('Budget credentials unavailable');
  expect(absent).not.toHaveBeenCalled();
  for (const response of [new Response('synthetic-private-body', { status: 403 }), new Response('invalid'),
    new Response(JSON.stringify({ receivedMessages: Array(11).fill(delivery) })), new Response('x'.repeat(1_048_577))]) {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => response);
    await expect(pubsubBudgetPort(subscription, async () => 't', fetch).pull(signal)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  }
});

test('credentials arriving after cancellation cannot issue a late request', async () => {
  const controller = new AbortController(); const fetch = vi.fn<typeof globalThis.fetch>();
  const port = pubsubBudgetPort(subscription, async () => { controller.abort(); return 't'; }, fetch);
  await expect(port.pull(controller.signal)).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
});
