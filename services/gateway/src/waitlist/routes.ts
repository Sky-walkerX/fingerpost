import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { clientKey, FixedWindowLimiter, overflowKey } from '../auth/rate-limit.ts';
import type { WaitlistStore } from './store.ts';

export const WaitlistBody = z
  .object({
    email: z.string().trim().email(),
    locale: z.enum(['en', 'hi', 'es']),
    website: z.string().optional().default(''),
  })
  .refine((b) => !b.website || b.website.length === 0, {
    message: 'honeypot must be empty',
  });

export interface WaitlistDeps {
  store: WaitlistStore;
  now?: () => number;
}

export function registerWaitlistRoute(app: FastifyInstance, d: WaitlistDeps): void {
  const now = d.now ?? Date.now;
  // 5 requests per minute per client IP
  const limiter = new FixedWindowLimiter(5, 60_000, now);

  app.options('/v1/waitlist', async (_req, reply) =>
    reply
      .header('access-control-allow-origin', '*')
      .header('access-control-allow-methods', 'POST, OPTIONS')
      .header('access-control-allow-headers', 'content-type')
      .code(204)
      .send()
  );

  app.post('/v1/waitlist', async (req, reply) => {
    reply.header('access-control-allow-origin', '*');

    const parsed = WaitlistBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request' });
    }

    if (!limiter.hit(clientKey(req.ip), overflowKey(req.ip))) {
      return reply.code(429).send({ error: 'rate limited' });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const locale = parsed.data.locale;
    const createdAt = now();

    // Never log the email.
    req.log.info({ waitlist: 'signup', locale }, 'waitlist entry received');

    await d.store.add({ email, locale, createdAt });
    return reply.code(200).send({ ok: true });
  });
}
