import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const Env = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(8080),
    MODEL_MODE: z.enum(['mock', 'live']).default('mock'),
    META_API_KEY: z.string().min(1).optional(),
    DEBUG_TOKEN: z.string().min(16).optional(),
    GIT_SHA: z.string().min(1).default('dev'),
    /** Per model call. Real Spark screen reads take 10–22 s (docs/progress.md, D1-T5), so 5 s always timed out. */
    MODEL_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(30_000),
    /** Kiosk memory: distinct attested installs that must agree before a screen is served from memory (design §4.9). */
    MEMORY_MIN_INSTALLS: z.coerce.number().int().min(1).max(5).default(2),
    /** Salt for install and text hashes in kiosk_layouts. Unset: a random per-process salt (memory then lasts one run). */
    MEMORY_SALT: z.string().min(16).optional(),
    /** Task planner: Spark tool calling (falls back to rules on error) or the deterministic rules planner. */
    AGENT_PLANNER: z.enum(['spark', 'rules']).optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    // Day 2
    SIM_TOKEN: z.string().min(8).optional(),
    // Day 3: auth (ADR 0004) and quotas (design §4.5)
    AUTH_REQUIRED: bool.optional(),
    SESSION_SECRET: z.string().min(32).optional(),
    /** Comma-separated lowercase hex SHA-256 of the app signing certificates (release, and debug in dev). */
    SIGNING_DIGESTS: z.string().regex(/^[0-9a-f]{64}(,[0-9a-f]{64})*$/).optional(),
    /** Software (non-TEE) attestations are forgeable; allowed by default only in mock/dev. */
    ALLOW_SOFTWARE_ATTESTATION: bool.optional(),
    /** Escape hatch for the pre-auth dev deploys (Days 1–3) only. Never set it in prod. */
    ALLOW_UNAUTHENTICATED_LIVE: bool.default(false),
    DAILY_CAP_USD: z.coerce.number().positive().default(12),
    FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  })
  .transform((e) => ({ ...e, AUTH_REQUIRED: e.AUTH_REQUIRED ?? e.MODEL_MODE === 'live', ALLOW_SOFTWARE_ATTESTATION: e.ALLOW_SOFTWARE_ATTESTATION ?? e.MODEL_MODE !== 'live' }))
  .superRefine((e, ctx) => {
    if (e.MODEL_MODE === 'live' && !e.META_API_KEY) ctx.addIssue({ code: 'custom', path: ['META_API_KEY'], message: 'META_API_KEY is required when MODEL_MODE=live' });
    if (e.MODEL_MODE === 'live' && !e.AUTH_REQUIRED && !e.ALLOW_UNAUTHENTICATED_LIVE) ctx.addIssue({ code: 'custom', path: ['AUTH_REQUIRED'], message: 'AUTH_REQUIRED=false in live mode needs ALLOW_UNAUTHENTICATED_LIVE=true (dev deploys only)' });
    if (e.AUTH_REQUIRED && !e.SESSION_SECRET) ctx.addIssue({ code: 'custom', path: ['SESSION_SECRET'], message: 'SESSION_SECRET (32+ chars) is required when AUTH_REQUIRED' });
    if (e.AUTH_REQUIRED && !e.SIGNING_DIGESTS) ctx.addIssue({ code: 'custom', path: ['SIGNING_DIGESTS'], message: 'SIGNING_DIGESTS is required when AUTH_REQUIRED' });
  });
export type Config = z.infer<typeof Env>;

export function loadConfig(env: Record<string, string | undefined>): Config {
  const r = Env.safeParse(env);
  if (!r.success) throw new Error('Invalid gateway config: ' + r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return r.data;
}
