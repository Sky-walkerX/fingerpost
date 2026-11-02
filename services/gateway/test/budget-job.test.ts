import { expect, test, vi } from 'vitest';
import { loadBudgetConfig, runBudgetJob, type BudgetMessage, type BudgetPort } from '../src/budget/job.ts';
import { MemoryFlagStore } from '../src/quota/ports.ts';

const env = { BUDGET_PROJECT_ID: 'synthetic-project', BUDGET_SUBSCRIPTION: 'projects/synthetic-project/subscriptions/budget-stop',
  BUDGET_BILLING_ACCOUNT_ID: 'AAAAAA-BBBBBB-CCCCCC', BUDGET_ID: '00000000-0000-4000-8000-000000000001', BUDGET_TIME_ZONE: 'UTC' };
const cfg = () => loadBudgetConfig(env);
const T = Date.UTC(2026, 10, 2);
const payload = { budgetDisplayName: 'Synthetic budget', costAmount: 100, budgetAmount: 100,
  budgetAmountType: 'SPECIFIED_AMOUNT', currencyCode: 'USD', alertThresholdExceeded: 1, costIntervalStart: '2026-11-01T00:00:00Z' };
const msg = (change = {}, attributes = {}): BudgetMessage => ({ ackId: 'synthetic-ack', message: {
  messageId: 'synthetic-id', publishTime: '2026-11-02T00:00:00Z', data: Buffer.from(JSON.stringify({ ...payload, ...change })).toString('base64'),
  attributes: { billingAccountId: env.BUDGET_BILLING_ACCOUNT_ID, budgetId: env.BUDGET_ID, schemaVersion: '1.0', ...attributes } } });
function setup(messages: BudgetMessage[], flags = new MemoryFlagStore()) {
  const ack = vi.fn(async (_ids: string[], _signal: AbortSignal) => {});
  const port: BudgetPort = { pull: async () => messages, acknowledge: ack };
  return { flags, ack, run: () => runBudgetJob(cfg(), port, flags, new AbortController().signal, () => T) };
}

test('an actual configured budget breach persists disablement before acknowledgement; duplicates never enable', async () => {
  const s = setup([msg(), msg()]);
  s.ack.mockImplementation(async () => { expect(s.flags.enabled).toBe(false); });
  expect(await s.run()).toEqual({ received: 2, disabled: 2, ignored: 0 });
  expect(s.flags.reason).toBe('billing budget threshold reached');
  expect(s.ack).toHaveBeenCalledTimes(2);
});

test('forecasts and spend below the stop ratio do not disable or re-enable cloud', async () => {
  const s = setup([msg({ costAmount: 79, alertThresholdExceeded: 0.5, forecastThresholdExceeded: 1.5 }), msg({ costAmount: 99.99 })], new MemoryFlagStore(false));
  expect(await s.run()).toEqual({ received: 2, disabled: 0, ignored: 2 });
  expect(s.flags.enabled).toBe(false); expect(s.ack).toHaveBeenCalledTimes(2);
});

test('foreign budget/account, wrong currency, old interval, unknown schema and malformed data cannot mutate flags', async () => {
  const bad = msg(); bad.message.data = '%%%';
  const s = setup([msg({}, { budgetId: 'foreign' }), msg({}, { billingAccountId: 'foreign' }),
    msg({ currencyCode: 'EUR' }), msg({ costIntervalStart: '2026-10-01T00:00:00Z' }), msg({}, { schemaVersion: '2.0' }), bad,
    msg({ costAmount: -1 }), msg({ budgetAmount: 0 }), msg({ costIntervalStart: '2026-11-01T12:00:00Z' })]);
  expect((await s.run()).disabled).toBe(0); expect(s.flags.enabled).toBe(true);
});

test('billing timezone boundaries are checked in the configured calendar month', async () => {
  const c = loadBudgetConfig({ ...env, BUDGET_TIME_ZONE: 'America/Los_Angeles' });
  const s = setup([]);
  await runBudgetJob(c, { pull: async () => [msg({ costIntervalStart: '2026-11-01T07:00:00Z' })], acknowledge: s.ack }, s.flags,
    new AbortController().signal, () => T);
  expect(s.flags.enabled).toBe(false);
});

test('failed durable disable leaves delivery unacknowledged for retry', async () => {
  const s = setup([msg()], { ...new MemoryFlagStore(), getCloudEnabled: async () => true,
    setCloudEnabled: async () => { throw new Error('synthetic private error'); } });
  await expect(s.run()).rejects.toThrow('Budget disable failed'); expect(s.ack).not.toHaveBeenCalled();
});

test('an aborted run performs no writes or acknowledgements', async () => {
  const flags = new MemoryFlagStore(); const controller = new AbortController(); controller.abort();
  const pull = vi.fn(async () => [msg()]), ack = vi.fn(async () => {});
  await expect(runBudgetJob(cfg(), { pull, acknowledge: ack }, flags, controller.signal, () => T)).rejects.toThrow();
  expect(pull).not.toHaveBeenCalled(); expect(ack).not.toHaveBeenCalled(); expect(flags.enabled).toBe(true);
});

test('configuration requires explicit budget identity, subscription project and valid timezone', () => {
  expect(cfg().stopRatio).toBe(1);
  for (const change of [{ BUDGET_ID: '' }, { BUDGET_SUBSCRIPTION: 'projects/foreign-project/subscriptions/x' },
    { BUDGET_TIME_ZONE: 'unknown/zone' }, { BUDGET_STOP_RATIO: 'NaN' }, { BUDGET_STOP_RATIO: '0' }])
    expect(() => loadBudgetConfig({ ...env, ...change })).toThrow('Invalid budget job config');
});

test('job disablement is observed by the existing gateway configuration path after its documented cache interval', async () => {
  const { buildApp } = await import('../src/app.ts');
  const { loadConfig } = await import('../src/config.ts');
  let now = T;
  const s = setup([msg()]);
  const app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }), { flagStore: s.flags, now: () => now });
  try {
    expect((await app.inject('/v1/config')).json().cloudEnabled).toBe(true);
    await s.run();
    now += 30_001;
    expect((await app.inject('/v1/config')).json().cloudEnabled).toBe(false);
  } finally { await app.close(); }
});
