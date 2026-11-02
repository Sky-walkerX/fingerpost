import { expect, test, vi } from 'vitest';
import { encodeFrame, type ServerMessage } from '@fingerpost/protocol';
import { createSessionController, type AsrFactory } from '../src/session/controller.ts';
import type { AsrSink } from '../src/asr/relay.ts';
import { MOCK_LAYOUT, mockModels } from '../src/models/mock/mock-models.ts';
import { createRouter } from '../src/models/router.ts';
import { SimRegistry } from '../src/sim/registry.ts';

const hello = (privacy: 'normal' | 'private') => ({ type: 'hello', id: 'h', ts: 1, appVersion: '0.1.0',
  protocol: 'fp.v1', locale: 'en', mode: 'guide', privacy, caps: {} });
const audio = encodeFrame({ type: 'audio', id: 'a', ts: 1, seq: 0, sampleRate: 16000 }, new Uint8Array(640));
const keyframe = encodeFrame({ type: 'keyframe', id: 'k', ts: 1, kind: 'screen', purpose: 'locate',
  imageSize: { w: 1000, h: 500 }, ocrTokens: [] }, new Uint8Array([0xff, 0xd8]));
function setup(sensitivity: 'none' | 'financial' | 'identity' = 'none') {
  const sent: ServerMessage[] = [], sinks: AsrSink[] = [];
  const close = vi.fn();
  const asr = vi.fn<AsrFactory>((_o, sink) => { sinks.push(sink); return { push() {}, end() {}, close }; });
  const meta = mockModels({ ...MOCK_LAYOUT, sensitivity });
  const controller = createSessionController({ models: meta, router: createRouter({ meta, glimmer: meta }),
    asr, sims: new SimRegistry(), send: m => sent.push(m) });
  const text = (m: object) => controller.hub.onText(JSON.stringify(m));
  return { ...controller, sent, text, asr, close, sinks };
}

test('a private session never opens Meta ASR, including before a layout exists', async () => {
  const c = setup(); await c.text(hello('private'));
  await c.hub.onBinary(audio); await c.hub.onBinary(audio);
  expect(c.asr).not.toHaveBeenCalled();
  expect(c.sent.filter(m => m.type === 'mode')).toMatchObject([{ mode: 'private' }]);
  c.dispose();
});

test.each(['financial', 'identity'] as const)('%s classification closes ASR and suppresses late results and protected keyword uploads', async sensitivity => {
  const c = setup(sensitivity); await c.text(hello('normal')); await c.hub.onBinary(audio);
  await c.text({ type: 'goal', id: 'g', ts: 1, text: 'start', source: 'asr_device' });
  await c.hub.onBinary(audio);
  await c.hub.onBinary(keyframe);
  expect(c.close).toHaveBeenCalledTimes(2);
  const length = c.sent.length; c.sinks[1]!.final('Stale synthetic answer');
  expect(c.sent).toHaveLength(length);
  await c.hub.onBinary(audio);
  expect(c.asr).toHaveBeenCalledTimes(2);
  c.dispose();
});
