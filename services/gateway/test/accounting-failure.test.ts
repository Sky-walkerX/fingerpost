import { expect, test, vi } from 'vitest';
import { encodeFrame, type ServerMessage } from '@fingerpost/protocol';
import { mockModels } from '../src/models/mock/mock-models.ts';
import { MemoryFlagStore, MemoryQuotaStore } from '../src/quota/ports.ts';
import { QuotaService } from '../src/quota/service.ts';
import { createSessionController } from '../src/session/controller.ts';
import { SimRegistry } from '../src/sim/registry.ts';
import type { AsrSink } from '../src/asr/relay.ts';

const hello = { type: 'hello', id: 'h', ts: 1, appVersion: '0.1.0', protocol: 'fp.v1', locale: 'en', mode: 'guide', privacy: 'normal', caps: {} };
const goal = { type: 'goal', id: 'g', ts: 2, text: 'start', source: 'typed' };
const frame = encodeFrame({ type: 'keyframe', id: 'k', ts: 3, kind: 'screen', purpose: 'locate', imageSize: { w: 1000, h: 500 }, ocrTokens: [] }, new Uint8Array([0xff, 0xd8]));

test('a ledger write failure latches cloud off and attempts to persist the kill switch', async () => {
  const store = new MemoryQuotaStore(), flags = new MemoryFlagStore();
  store.addSpend = async () => { throw new Error('synthetic storage failure'); };
  const quota = new QuotaService(store, flags);
  expect(await quota.cloudEnabled()).toBe(true);
  await expect(quota.recordUsage({ kind: 'sam_image', images: 1 })).rejects.toThrow();
  expect(flags.enabled).toBe(false);
  flags.enabled = true;
  expect(await quota.cloudEnabled()).toBe(false);
  expect(await quota.startTask('synthetic-user', 'hardware')).toEqual({ ok: false, code: 'cloud_paused' });
  expect(store.tasks.size).toBe(0);
});

test('failure to persist a cap disable cannot leave the local flag cache enabled', async () => {
  const flags = new MemoryFlagStore();
  flags.setCloudEnabled = async () => { throw new Error('synthetic flag failure'); };
  const quota = new QuotaService(new MemoryQuotaStore(), flags, { tasksPerDay: { hardware: 30, software: 10 }, dailyCapMicros: 1, flagCacheMs: 30_000 });
  expect(await quota.cloudEnabled()).toBe(true);
  await expect(quota.recordUsage({ kind: 'sam_image', images: 1 })).rejects.toThrow();
  expect(await quota.cloudEnabled()).toBe(false);
});

test('a flag read already in flight cannot re-enable cloud after an accounting failure', async () => {
  let release!: (enabled: boolean) => void;
  const flags = new MemoryFlagStore(), store = new MemoryQuotaStore();
  flags.getCloudEnabled = () => new Promise(resolve => { release = resolve; });
  store.addSpend = async () => { throw new Error('synthetic storage failure'); };
  const quota = new QuotaService(store, flags), reading = quota.cloudEnabled();
  await expect(quota.recordUsage({ kind: 'sam_image', images: 1 })).rejects.toThrow();
  release(true);
  expect(await reading).toBe(false);
});

test('an in-flight enable read cannot override reaching the daily spend cap', async () => {
  let release!: (enabled: boolean) => void;
  const flags = new MemoryFlagStore();
  flags.getCloudEnabled = () => new Promise(resolve => { release = resolve; });
  const quota = new QuotaService(new MemoryQuotaStore(), flags,
    { tasksPerDay: { hardware: 30, software: 10 }, dailyCapMicros: 1, flagCacheMs: 30_000 });
  const reading = quota.cloudEnabled();
  await quota.recordUsage({ kind: 'sam_image', images: 1 });
  release(true);
  expect(await reading).toBe(false);
  expect(await quota.cloudEnabled()).toBe(false);
});

test('a failed parse charge stops refinement, later calls and target delivery', async () => {
  const models = mockModels(); models.parseScreen = vi.fn(models.parseScreen); models.segmentByBox = vi.fn(models.segmentByBox);
  const sent: ServerMessage[] = [];
  const c = createSessionController({ models, sims: new SimRegistry(), send: m => sent.push(m),
    asr: () => { throw new Error('unused'); }, claims: { uid: 'synthetic-user', keyId: 'synthetic-key', tier: 'hardware' },
    quota: { cloudEnabled: async () => true, startTask: async () => ({ ok: true, tasksLeft: 29 }), recordUsage: async () => { throw new Error('synthetic ledger failure'); } } });
  try {
    await c.hub.onText(JSON.stringify(hello)); await c.hub.onText(JSON.stringify(goal)); await c.hub.onBinary(frame);
    await vi.waitFor(() => expect(sent.some(m => m.type === 'error' && m.code === 'cloud_paused')).toBe(true));
    await c.hub.onText(JSON.stringify(goal)); await c.hub.onBinary(frame);
    expect(models.parseScreen).toHaveBeenCalledTimes(1);
    expect(models.segmentByBox).not.toHaveBeenCalled();
    expect(sent.some(m => m.type === 'target')).toBe(false);
    expect(JSON.stringify(sent)).not.toContain('synthetic ledger failure');
  } finally { c.dispose(); }
});

test('ASR accounting failure stops the turn without publishing its transcript or goal', async () => {
  let sink: AsrSink | undefined;
  const closed = vi.fn(), sent: ServerMessage[] = [];
  const c = createSessionController({ models: mockModels(), sims: new SimRegistry(), send: m => sent.push(m),
    asr: (_o, s) => { sink = s; return { push() {}, end() {}, close: closed }; },
    quota: { cloudEnabled: async () => true, startTask: async () => ({ ok: true, tasksLeft: 29 }), recordUsage: async () => { throw new Error('synthetic ledger failure'); } } });
  try {
    await c.hub.onText(JSON.stringify(hello));
    await c.hub.onBinary(encodeFrame({ type: 'audio', id: 'a', ts: 2, seq: 0, sampleRate: 16000 }, new Uint8Array(640)));
    sink!.final('synthetic goal');
    await vi.waitFor(() => expect(sent.some(m => m.type === 'error' && m.code === 'cloud_paused')).toBe(true));
    expect(closed).toHaveBeenCalled();
    expect(sent.some(m => m.type === 'transcript' || m.type === 'goal.ack')).toBe(false);
  } finally { c.dispose(); }
});
