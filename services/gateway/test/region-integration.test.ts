import { afterEach, expect, test, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { mockModels } from '../src/models/mock/mock-models.ts';
import { probeAsrConnection } from '../src/debug/asr-probe.ts';
import { measureFullRegion } from '../scripts/region-runner.ts';

let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });
const token = 'synthetic-debug-token';
const image = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 2, 64, 4, 0, 1, 1, 0x11, 0, 0xff, 0xd9]);

test('native Node sockets complete real local HTTP plus binary keyframe-to-target exchanges', async () => {
  const models = mockModels();
  const parse = vi.spyOn(models, 'parseScreen');
  const segment = vi.spyOn(models, 'segmentByBox');
  const asrProbe = vi.fn().mockResolvedValue({ connectMs: 1, readyMs: 2 });
  app = await buildApp(loadConfig({ DEBUG_TOKEN: token, LOG_LEVEL: 'silent' }), { models, asrProbe });
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const result = await measureFullRegion(new URL(address), image, token, 'Start', 2);
  expect(result).toMatchObject({ mode: 'mock', samples: 2, maskFallbacks: 0,
    asrConnectMs: { p50: 1, p95: 1 }, asrReadyMs: { p50: 2, p95: 2 } });
  expect(result.keyframeToTargetMs.p50).toBeGreaterThan(0);
  expect(parse).toHaveBeenCalledTimes(2);
  expect(segment).toHaveBeenCalledTimes(2);
  expect(asrProbe).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(result)).not.toMatch(/Start|synthetic-debug-token|elementId|polygon/);
});

test('the ASR native socket validates a local provider acknowledgement without sending audio', async () => {
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }));
  const received: string[] = [];
  let binaryFrames = 0;
  app.get('/fake-asr', { websocket: true }, (socket) => {
    socket.on('message', (data: Buffer, binary: boolean) => {
      if (binary) { binaryFrames++; return; }
      received.push(JSON.parse(data.toString()).type ?? 'handshake');
      if (received.length === 1) socket.send(JSON.stringify({ sessionId: 'synthetic-private-provider-session' }));
    });
  });
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const result = await probeAsrConnection('synthetic-api-key', {
    createSocket: () => new WebSocket(address.replace('http:', 'ws:') + '/fake-asr'),
  });
  expect(result.connectMs).toBeGreaterThanOrEqual(0);
  expect(result.readyMs).toBeGreaterThanOrEqual(result.connectMs);
  expect(binaryFrames).toBe(0);
  expect(Object.keys(result).sort()).toEqual(['connectMs', 'readyMs']);
});
