import { z } from 'zod';
import { BudgetMessageSchema, type BudgetPort } from './job.ts';

export function pubsubBudgetPort(subscription: string, getToken: () => Promise<string>,
  fetcher: typeof fetch = fetch): BudgetPort {
  if (!/^projects\/[a-z][a-z0-9-]{4,28}[a-z0-9]\/subscriptions\/[A-Za-z][A-Za-z0-9._~+-]{2,254}$/.test(subscription))
    throw new Error('Invalid budget subscription');
  async function request(action: 'pull' | 'acknowledge', payload: object, signal: AbortSignal) {
    const token = await getToken();
    signal.throwIfAborted();
    if (!token) throw new Error('Budget credentials unavailable');
    const response = await fetcher(`https://pubsub.googleapis.com/v1/${subscription}:${action}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Budget transport failed');
    return response;
  }
  return {
    async pull(signal) {
      const response = await request('pull', { maxMessages: 10 }, signal);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Invalid budget response');
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 1_048_576) throw new Error('Budget response exceeds limit');
          chunks.push(value);
        }
        const body: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
        const parsed = z.object({ receivedMessages: z.array(BudgetMessageSchema).max(10).default([]) }).safeParse(body);
        if (!parsed.success) throw new Error('Invalid budget response');
        return parsed.data.receivedMessages;
      } finally { await reader.cancel().catch(() => {}); }
    },
    async acknowledge(ids, signal) { await request('acknowledge', { ackIds: ids }, signal); },
  };
}
