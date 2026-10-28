import { afterEach, expect, test, vi } from 'vitest';
import { probeAsrConnection, type DiagnosticSocket } from '../src/debug/asr-probe.ts';

class FakeSocket extends EventTarget implements DiagnosticSocket {
  sent: (string | Uint8Array)[] = [];
  closed = false;
  send(data: string | Uint8Array) { this.sent.push(data); }
  close() { this.closed = true; }
  open() { this.dispatchEvent(new Event('open')); }
  message(data: unknown) { this.dispatchEvent(new MessageEvent('message', { data })); }
}
afterEach(() => vi.useRealTimers());

test('connect timing waits for the authenticated handshake and sends no audio', async () => {
  const socket = new FakeSocket();
  let clock = 10;
  const createSocket = vi.fn(() => socket);
  const result = probeAsrConnection('synthetic-api-key', { createSocket, now: () => clock });
  clock = 40; socket.open();
  expect(socket.closed).toBe(false);
  clock = 90; socket.message(JSON.stringify({ sessionId: 'synthetic-private-session' }));
  expect(await result).toEqual({ connectMs: 30, readyMs: 80 });
  expect(createSocket).toHaveBeenCalledWith('wss://api.meta.ai/v1/asr/realtime');
  expect(JSON.parse(String(socket.sent[0]))).toEqual({
    authorization: { accessToken: 'Bearer synthetic-api-key' }, audioEncoding: 'PCM_16KHZ',
    model: 'muse-voice-transcribe-1.0', mode: 'ENDPOINTING', partialMode: 'CUMULATIVE',
    emitAudioProgress: false, languageBias: ['English'], keywords: [],
  });
  expect(socket.sent.map(String).map((s) => JSON.parse(s))).toHaveLength(2);
  expect(JSON.parse(String(socket.sent[1]))).toEqual({ type: 'endStream' });
  expect(socket.sent.every((data) => typeof data === 'string')).toBe(true);
  expect(socket.closed).toBe(true);
});

test.each([
  'not json', JSON.stringify({ type: 'error', message: 'synthetic-private-key-and-text', sessionId: 'x' }),
  JSON.stringify({ sessionId: '' }), JSON.stringify({ sessionId: 'x', transcript: 'synthetic-private' }),
])('unaccepted handshakes never produce successful or content-bearing metrics', async (message) => {
  const socket = new FakeSocket();
  const result = probeAsrConnection('synthetic-key', { createSocket: () => socket });
  const failure = expect(result).rejects.toThrow(/^ASR connection probe failed$/);
  socket.open(); socket.message(message);
  await failure;
  expect(socket.closed).toBe(true);
});

test('socket closure before acknowledgement rejects the sample', async () => {
  const socket = new FakeSocket();
  const result = probeAsrConnection('synthetic-key', { createSocket: () => socket });
  const failure = expect(result).rejects.toThrow(/^ASR connection probe failed$/);
  socket.open(); socket.dispatchEvent(new Event('close'));
  await failure;
});

test('timeout cleans up and cannot be turned into success by a late acknowledgement', async () => {
  vi.useFakeTimers();
  const socket = new FakeSocket();
  const result = probeAsrConnection('synthetic-key', { createSocket: () => socket, timeoutMs: 10 });
  const failure = result.catch((error: unknown) => error);
  socket.open();
  await vi.advanceTimersByTimeAsync(10);
  expect(await failure).toEqual(new Error('ASR connection probe failed'));
  socket.message(JSON.stringify({ sessionId: 'late' }));
  expect(socket.closed).toBe(true);
  expect(socket.sent).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});

test('a socket factory error is redacted', async () => {
  await expect(probeAsrConnection('synthetic-key', { createSocket: () => {
    throw new Error('synthetic-private-connection-detail');
  } })).rejects.toThrow(/^ASR connection probe failed$/);
});
