import { expect, test, vi } from 'vitest';
import { encodeFrame } from '@fingerpost/protocol';
import { createSessionController } from '../src/session/controller.ts';
import { mockModels, MOCK_LAYOUT } from '../src/models/mock/mock-models.ts';
import { mockAsr } from '../src/models/mock/mock-asr.ts';
import { SimRegistry } from '../src/sim/registry.ts';
import { TelemetryCollector } from '../src/telemetry/collector.ts';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';

async function run(sim: boolean, fail = false) {
  const telemetry = new TelemetryCollector(), models = mockModels(); let calls = 0;
  const parse = models.parseScreen;
  models.parseScreen = async (image, opts) => {
    calls++; if (fail) throw new Error('synthetic');
    const result = await parse(image, opts);
    return calls > 1 ? { ...result, layout: { ...MOCK_LAYOUT, elements: MOCK_LAYOUT.elements.slice(0, 1) } } : result;
  };
  const session = createSessionController({ telemetry, models, asr: mockAsr(), sims: new SimRegistry(), send: () => {} });
  await session.hub.onText(JSON.stringify({ type: 'hello', id: 'h1', ts: 1, protocol: 'fp.v1', appVersion: 'test', locale: 'en', mode: 'guide', privacy: 'normal', caps: sim ? { simRunId: 'synthetic' } : {} }));
  await session.hub.onText(JSON.stringify({ type: 'goal', id: 'g1', ts: 1, source: 'typed', text: 'start' }));
  for (const purpose of fail ? ['locate'] as const : ['locate', 'verify'] as const) await session.hub.onBinary(encodeFrame({ type: 'keyframe', id: purpose, ts: 1, kind: 'screen', purpose, imageSize: { w: 1000, h: 500 }, ocrTokens: [] }, new Uint8Array([0xff, 0xd8])));
  session.dispose(); return telemetry.snapshot();
}

test('a real session reports one task and numeric parse latency; simulator sessions are excluded', async () => {
  expect(await run(false)).toMatchObject({ taskSamples: 1, taskErrorRatio: 0, parseSamples: 2 });
  expect(await run(true)).toMatchObject({ taskSamples: 0, parseSamples: 0 });
});

test('failed parse attempts are included with one admitted task error', async () => {
  expect(await run(false, true)).toMatchObject({ taskSamples: 1, taskErrorRatio: 1, parseSamples: 1 });
});

test('mock app cannot enable production telemetry through an injected collector', async () => {
  const telemetry = new TelemetryCollector();
  const app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }), { telemetry });
  await app.ready();
  const ws = await app.injectWS('/v1/session'); let targeted = false;
  ws.on('message', (data: Buffer) => { if (JSON.parse(data.toString()).type === 'target') targeted = true; });
  try {
    ws.send(JSON.stringify({ type: 'hello', id: 'h1', ts: 1, protocol: 'fp.v1', appVersion: '0.1.0', locale: 'en', mode: 'guide', privacy: 'normal', caps: {} }));
    ws.send(JSON.stringify({ type: 'goal', id: 'g1', ts: 1, source: 'typed', text: 'start' }));
    ws.send(encodeFrame({ type: 'keyframe', id: 'k1', ts: 1, kind: 'screen', purpose: 'locate', imageSize: { w: 1000, h: 500 }, ocrTokens: [] }, new Uint8Array([0xff, 0xd8])));
    await vi.waitFor(() => expect(targeted).toBe(true));
    expect(telemetry.snapshot()).toMatchObject({ taskSamples: 0, parseSamples: 0 });
  } finally { ws.terminate(); await app.close(); }
});
