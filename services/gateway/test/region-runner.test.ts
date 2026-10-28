import { afterEach, expect, test, vi } from 'vitest';
import { decodeFrame } from '@fingerpost/protocol';
import { measureFullRegion, measureTarget } from '../scripts/region-runner.ts';
import type { DiagnosticSocket } from '../src/debug/asr-probe.ts';

const image = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 2, 64, 4, 0, 1, 1, 0x11, 0, 0xff, 0xd9]);
const url = new URL('https://synthetic-region.example');
const token = 'synthetic-debug-token';
const target = { type: 'target', id: 't', ts: 1, elementId: 'e5', polygon: [{ u: 0.6, v: 0.7 }, { u: 0.9, v: 0.7 }, { u: 0.9, v: 0.88 }], confidence: 0.9, say: 'Target ready.' };

class ScriptSocket extends EventTarget implements DiagnosticSocket {
  sent: (string | Uint8Array)[] = [];
  closed = false;
  constructor(private readonly reply: (data: string | Uint8Array) => unknown) { super(); }
  close() { this.closed = true; }
  send(data: string | Uint8Array) {
    this.sent.push(data);
    const response = this.reply(data);
    if (response !== undefined) queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(response) })));
  }
}

function scenario(mode: 'mock' | 'live' = 'live', result: unknown = { message: target, timings: { sparkMs: 40, samMs: 60, elements: 5, inputTokens: 8, samRefined: 1 } }) {
  let clock = 0;
  const sockets: ScriptSocket[] = [];
  const createSocket = vi.fn(() => {
    const socket = new ScriptSocket((data) => {
      if (typeof data !== 'string') { clock += 150; return result; }
      const message = JSON.parse(data);
      clock += 100;
      if ('token' in message) return { authenticated: true, mode };
      if (message.type === 'hello') return { message: { type: 'ready', id: 'r', ts: 1, sessionId: 's', quota: { tasksLeft: 30 }, flags: { cloudEnabled: true, privateAvailable: false } } };
      if (message.type === 'goal') return { message: { type: 'goal.ack', id: 'a', ts: 1, goal: message.text, intent: 'guide' } };
      throw new Error('Unexpected synthetic request');
    });
    sockets.push(socket);
    queueMicrotask(() => socket.dispatchEvent(new Event('open')));
    return socket;
  });
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (address) => {
    if (new URL(String(address)).pathname === '/healthz') { clock += 10; return Response.json({ status: 'ok', protocol: 'fp.v1' }); }
    clock += 80;
    return Response.json({ mode, connectMs: 20, readyMs: 70 });
  });
  return { createSocket, fetcher, sockets, now: () => clock };
}
afterEach(() => vi.restoreAllMocks());

test('times actual binary upload to validated target receipt, excluding session setup', async () => {
  const options = scenario();
  expect(await measureTarget(url, image, token, 'Start', options))
    .toEqual({ mode: 'live', sparkMs: 40, samMs: 60, keyframeToTargetMs: 150, samRefined: 1 });
  expect(options.createSocket).toHaveBeenCalledWith('wss://synthetic-region.example/v1/debug/region-target');
  const socket = options.sockets[0]!;
  expect(JSON.parse(String(socket.sent[0]))).toEqual({ token });
  const binary = socket.sent.find((data) => data instanceof Uint8Array);
  const decoded = decodeFrame(binary as Uint8Array);
  expect(decoded).toMatchObject({ ok: true, header: { type: 'keyframe', kind: 'screen', purpose: 'locate' }, payload: image });
  expect(socket.closed).toBe(true);
});

test('summarizes observed total samples independently of phase percentiles and includes accepted ASR timing', async () => {
  const options = scenario();
  expect(await measureFullRegion(url, image, token, 'Start', 2, options)).toEqual({
    mode: 'live', samples: 2, maskFallbacks: 0,
    rttMs: { p50: 10, p95: 10 }, asrConnectMs: { p50: 20, p95: 20 }, asrReadyMs: { p50: 70, p95: 70 },
    sparkMs: { p50: 40, p95: 40 }, samMs: { p50: 60, p95: 60 }, keyframeToTargetMs: { p50: 150, p95: 150 },
  });
  for (const [, init] of options.fetcher.mock.calls) expect(init?.redirect).toBe('error');
  expect(options.sockets.every((socket) => socket.closed)).toBe(true);
});

test('mock results retain their mode and cannot masquerade as live measurements', async () => {
  expect((await measureFullRegion(url, image, token, 'Start', 1, scenario('mock'))).mode).toBe('mock');
});

test.each([
  { message: { ...target, polygon: [] }, timings: { sparkMs: 1, samMs: 1, elements: 5, inputTokens: 8, samRefined: 1 } },
  { message: target },
  { message: target, timings: { sparkMs: -1, samMs: 1, elements: 5, inputTokens: 8, samRefined: 1 } },
  { message: target, timings: { sparkMs: 1, samMs: 1, elements: 5, inputTokens: 8, samRefined: 1, text: 'synthetic-private' } },
  { message: { type: 'error', id: 'e', ts: 1, code: 'model_unavailable', retryable: true, say: 'synthetic-private' } },
])('invalid targets, errors and private extra metrics are rejected without exposing content', async (response) => {
  await expect(measureTarget(url, image, token, 'Start', scenario('live', response))).rejects.toThrow(/^Target measurement failed$/);
});

test('private input validation happens before any network request', async () => {
  for (const [bytes, goal] of [[new Uint8Array([1, 2, 3]), 'Start'], [image, '']] as const) {
    const options = scenario();
    await expect(measureFullRegion(url, bytes, token, goal, 1, options)).rejects.toThrow();
    expect(options.fetcher).not.toHaveBeenCalled();
    expect(options.createSocket).not.toHaveBeenCalled();
  }
});

test.each([401, 404, 429, 503])('failed HTTP %i probes abort instead of contributing a timing', async (status) => {
  const options = scenario();
  options.fetcher.mockResolvedValue(new Response('synthetic-private', { status }));
  await expect(measureFullRegion(url, image, token, 'Start', 1, options)).rejects.toThrow(/^Regional measurement failed$/);
  expect(options.createSocket).not.toHaveBeenCalled();
});

test('mode mismatch and unaccepted ASR handshakes cannot yield a full result', async () => {
  for (const body of [{ mode: 'mock', connectMs: 20, readyMs: 70 }, { mode: 'live', connectMs: 70, readyMs: 20 }]) {
    const options = scenario('live');
    options.fetcher.mockImplementation(async (address) => Response.json(new URL(String(address)).pathname === '/healthz'
      ? { status: 'ok', protocol: 'fp.v1' } : body));
    await expect(measureFullRegion(url, image, token, 'Start', 1, options)).rejects.toThrow(/^Regional measurement failed$/);
  }
});
