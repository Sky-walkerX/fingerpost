import { afterEach, expect, test, vi } from 'vitest';

vi.mock('ws', async () => {
  const { EventEmitter } = await import('node:events');
  return { default: class Socket extends EventEmitter {
    static CONNECTING = 0;
    static OPEN = 1;
    readyState = 0;
    constructor(_url: string, options?: { handshakeTimeout?: number }) {
      super();
      if (options?.handshakeTimeout) setTimeout(() => this.emit('error', new Error('synthetic stalled handshake')), options.handshakeTimeout);
    }
    close() { this.readyState = 3; this.emit('close', 1000); }
    send() {}
  } };
});
import { openAsrRelay } from '../src/asr/relay.ts';
afterEach(() => vi.useRealTimers());

test('a stalled ASR handshake gives exactly one content-free error after five seconds', async () => {
  vi.useFakeTimers();
  const sink = { partial: vi.fn(), final: vi.fn(), error: vi.fn() };
  const relay = openAsrRelay({ apiKey: 'synthetic-key', locales: ['en'], keywords: [] }, sink);
  await vi.advanceTimersByTimeAsync(4999); expect(sink.error).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(sink.error).toHaveBeenCalledExactlyOnceWith('asr connection failed');
  relay.close(); relay.end(); await vi.advanceTimersByTimeAsync(5000);
  expect(sink.error).toHaveBeenCalledTimes(1); expect(sink.final).not.toHaveBeenCalled();
});
