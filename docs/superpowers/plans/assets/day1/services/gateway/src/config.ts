import { z } from 'zod';

const Env = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(8080),
    MODEL_MODE: z.enum(['mock', 'live']).default('mock'),
    META_API_KEY: z.string().min(1).optional(),
    DEBUG_TOKEN: z.string().min(16).optional(),
    GIT_SHA: z.string().min(1).default('dev'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  })
  .superRefine((e, ctx) => {
    if (e.MODEL_MODE === 'live' && !e.META_API_KEY) ctx.addIssue({ code: 'custom', path: ['META_API_KEY'], message: 'META_API_KEY is required when MODEL_MODE=live' });
  });
export type Config = z.infer<typeof Env>;

export function loadConfig(env: Record<string, string | undefined>): Config {
  throw new Error('TODO(D1-T3): implement this; the tests describe the behaviour');
}
