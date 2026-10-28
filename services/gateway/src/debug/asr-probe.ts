export interface AsrTimings { connectMs: number; readyMs: number; }
export interface DiagnosticSocket {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
  send(data: string | Uint8Array): void;
  close(code?: number): void;
}
export interface SocketOptions {
  createSocket?: (url: string) => DiagnosticSocket;
  timeoutMs?: number;
}

/** Measures upgrade and accepted handshake separately; never sends audio or retains session ids. */
export async function probeAsrConnection(
  apiKey: string, options: SocketOptions & { now?: () => number } = {},
): Promise<AsrTimings> {
  if (!apiKey.trim()) throw new Error('ASR connection probe failed');
  const now = options.now ?? (() => performance.now());
  const started = now();
  let connectMs: number | undefined;
  return socketExchange('wss://api.meta.ai/v1/asr/realtime', options, 'ASR connection probe failed', (socket) => {
    connectMs = now() - started;
    socket.send(JSON.stringify({
      authorization: { accessToken: `Bearer ${apiKey}` }, audioEncoding: 'PCM_16KHZ',
      model: 'muse-voice-transcribe-1.0', mode: 'ENDPOINTING', partialMode: 'CUMULATIVE',
      emitAudioProgress: false, languageBias: ['English'], keywords: [],
    }));
  }, (data, socket) => {
    const ready = z.strictObject({ sessionId: z.string().min(1).max(256) }).safeParse(data);
    if (!ready.success || connectMs === undefined) throw new Error('Invalid handshake');
    const readyMs = now() - started;
    if (!Number.isFinite(connectMs) || connectMs < 0 || !Number.isFinite(readyMs) || readyMs < connectMs)
      throw new Error('Invalid timing');
    socket.send(JSON.stringify({ type: 'endStream' }));
    return { connectMs, readyMs };
  });
}
import { z } from 'zod';
import { socketExchange } from './socket.ts';
