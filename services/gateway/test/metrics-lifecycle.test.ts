import { expect, test } from 'vitest';
import type { Keyframe, ServerMessage } from '@fingerpost/protocol';
import { SessionPipeline, type PipelineDeps } from '../src/session/pipeline.ts';
import { mockModels } from '../src/models/mock/mock-models.ts';

const frame = (purpose: Keyframe['purpose']): Keyframe => ({ type: 'keyframe', id: 'k1', ts: 1, kind: 'screen', purpose, imageSize: { w: 1000, h: 500 }, ocrTokens: [] });
const image = new Uint8Array([0xff, 0xd8]);
function setup(extra: Partial<PipelineDeps> = {}) {
  const outcomes: string[] = [], sent: ServerMessage[] = [];
  let admissions = 0;
  const pipeline = new SessionPipeline({ models: mockModels(), send: (m) => sent.push(m),
    onTask: () => { admissions++; return (result: string) => outcomes.push(result); }, ...extra });
  return { pipeline, outcomes, sent, admitted: () => admissions };
}

test('one admitted guide counts success once after verified press, not a target or retry', async () => {
  const { pipeline: p, outcomes, admitted } = setup();
  p.onGoal('start'); await p.onKeyframe(frame('locate'), image);
  expect(admitted()).toBe(1); expect(outcomes).toEqual([]);
  await p.onKeyframe(frame('verify'), image); expect(outcomes).toEqual([]);
  p.onSimTouch('start'); await p.onKeyframe(frame('verify'), image);
  p.onSimTouch('start'); await p.onKeyframe(frame('verify'), image);
  expect(outcomes).toEqual(['success']);
});

test('pre-admission rejection is excluded, cancellation is distinct from failure', async () => {
  const rejected = setup({ beforeTask: async () => ({ ok: false, code: 'quota_exhausted' }) });
  rejected.pipeline.onGoal('start'); await rejected.pipeline.onKeyframe(frame('locate'), image);
  expect(rejected.admitted()).toBe(0); expect(rejected.outcomes).toEqual([]);
  const active = setup(); active.pipeline.onGoal('start'); await active.pipeline.onKeyframe(frame('locate'), image);
  active.pipeline.abort(); active.pipeline.abort(); expect(active.outcomes).toEqual(['cancelled']);
});

test('model failure after admission counts one error and cannot poison a later goal', async () => {
  const models = mockModels(); const normal = models.parseScreen; let calls = 0;
  models.parseScreen = async (image, opts) => { if (++calls === 1) throw new Error('synthetic'); return normal(image, opts); };
  const { pipeline: p, outcomes } = setup({ models });
  p.onGoal('start'); await expect(p.onKeyframe(frame('locate'), image)).rejects.toThrow('synthetic');
  p.onGoal('start'); await p.onKeyframe(frame('locate'), image); p.onSimTouch('start'); await p.onKeyframe(frame('verify'), image);
  expect(outcomes).toEqual(['error', 'success']);
});

test('replacing a stalled task cancels its count and ignores a late model failure', async () => {
  let reject!: (error: Error) => void;
  const pending = new Promise<never>((_resolve, fail) => { reject = fail; });
  let started = false;
  const models = mockModels(); models.parseScreen = async () => { started = true; return pending; };
  const { pipeline: p, outcomes, admitted } = setup({ models });
  p.onGoal('start'); const work = p.onKeyframe(frame('locate'), image);
  for (let i = 0; i < 30 && !started; i++) await Promise.resolve();
  expect(started).toBe(true); expect(admitted()).toBe(1);
  p.onGoal('timer'); reject(new Error('synthetic')); await work;
  expect(outcomes).toEqual(['cancelled']);
});

test('a completed explore summary is a successful terminal task', async () => {
  const { pipeline: p, outcomes } = setup();
  p.setMode('explore'); p.onGoal('explore'); await p.onKeyframe(frame('explore'), image);
  p.onGoal('more'); expect(outcomes).toEqual(['success']);
});
