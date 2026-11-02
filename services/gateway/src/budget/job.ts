import { z } from 'zod';
import type { FlagStore } from '../quota/ports.ts';

const projectId = z.string().regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/);
const Env = z.object({
  BUDGET_PROJECT_ID: projectId,
  BUDGET_SUBSCRIPTION: z.string().regex(/^projects\/[a-z0-9-]+\/subscriptions\/[A-Za-z][A-Za-z0-9._~+-]{2,254}$/),
  BUDGET_BILLING_ACCOUNT_ID: z.string().regex(/^[A-F0-9]{6}-[A-F0-9]{6}-[A-F0-9]{6}$/i),
  BUDGET_ID: z.uuid(),
  BUDGET_TIME_ZONE: z.string().refine(value => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
  }),
  BUDGET_CURRENCY: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  BUDGET_STOP_RATIO: z.coerce.number().positive().max(1).default(1),
}).refine(e => e.BUDGET_SUBSCRIPTION.startsWith(`projects/${e.BUDGET_PROJECT_ID}/`));

export function loadBudgetConfig(env: Record<string, string | undefined>) {
  const result = Env.safeParse(env);
  if (!result.success) throw new Error('Invalid budget job config');
  const e = result.data;
  return { projectId: e.BUDGET_PROJECT_ID, subscription: e.BUDGET_SUBSCRIPTION,
    billingAccount: e.BUDGET_BILLING_ACCOUNT_ID, budgetId: e.BUDGET_ID, timeZone: e.BUDGET_TIME_ZONE,
    currency: e.BUDGET_CURRENCY, stopRatio: e.BUDGET_STOP_RATIO };
}
export type BudgetConfig = ReturnType<typeof loadBudgetConfig>;

export const BudgetMessageSchema = z.object({
  ackId: z.string().min(1).max(4096),
  message: z.object({
    messageId: z.string().min(1).max(256), publishTime: z.iso.datetime({ offset: true }),
    data: z.string().max(32_768), attributes: z.record(z.string(), z.string()).default({}),
  }),
});
export type BudgetMessage = z.infer<typeof BudgetMessageSchema>;
export interface BudgetPort {
  pull(signal: AbortSignal): Promise<BudgetMessage[]>;
  acknowledge(ids: string[], signal: AbortSignal): Promise<void>;
}
const Notification = z.object({
  costAmount: z.number().nonnegative(), budgetAmount: z.number().positive(),
  budgetAmountType: z.literal('SPECIFIED_AMOUNT'), currencyCode: z.string(),
  alertThresholdExceeded: z.number().nonnegative().optional(),
  costIntervalStart: z.iso.datetime({ offset: true }),
});

function calendar(timestamp: number, timeZone: string): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(timestamp).map(p => [p.type, p.value]));
}

/** Only a current, explicitly allowlisted monthly budget's actual spend can pause the cloud. */
function breached(cfg: BudgetConfig, message: BudgetMessage['message'], now: number): boolean {
  const a = message.attributes;
  if (a.budgetId !== cfg.budgetId || a.billingAccountId !== cfg.billingAccount || a.schemaVersion !== '1.0') return false;
  if (Date.parse(message.publishTime) > now) return false;
  try {
    const bytes = Buffer.from(message.data, 'base64');
    if (bytes.toString('base64') !== message.data) return false;
    const parsed = Notification.safeParse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    if (!parsed.success) return false;
    const n = parsed.data;
    const start = Date.parse(n.costIntervalStart);
    if (start > now) return false;
    const period = calendar(start, cfg.timeZone), current = calendar(now, cfg.timeZone);
    if (period.year !== current.year || period.month !== current.month || period.day !== '01' ||
        period.hour !== '00' || period.minute !== '00' || period.second !== '00') return false;
    return n.currencyCode === cfg.currency && (n.alertThresholdExceeded ?? 0) >= cfg.stopRatio &&
      n.costAmount / n.budgetAmount >= cfg.stopRatio;
  } catch { return false; }
}

/** Cloud Run job: IAM/ADC pull delivery, no public HTTP endpoint, no content/identity logging. */
export async function runBudgetJob(cfg: BudgetConfig, port: BudgetPort, flags: FlagStore, signal: AbortSignal,
  now: () => number = Date.now): Promise<{ received: number; disabled: number; ignored: number }> {
  signal.throwIfAborted();
  const batch = await port.pull(signal);
  signal.throwIfAborted();
  if (batch.length > 10) throw new Error('Budget batch exceeds limit');
  const result = { received: batch.length, disabled: 0, ignored: 0 };
  for (const raw of batch) {
    const parsed = BudgetMessageSchema.safeParse(raw);
    if (!parsed.success) throw new Error('Invalid budget delivery');
    signal.throwIfAborted();
    if (breached(cfg, parsed.data.message, now())) {
      try { await flags.setCloudEnabled(false, 'billing budget threshold reached'); }
      catch { throw new Error('Budget disable failed'); }
      result.disabled++;
    } else result.ignored++;
    // Retried deliveries only disable again. Never acknowledge a failed durable update or enable cloud.
    signal.throwIfAborted();
    await port.acknowledge([parsed.data.ackId], signal);
  }
  return result;
}
