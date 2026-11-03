import WebSocket from 'ws';
import { z } from 'zod';
import type { Locale } from '@fingerpost/protocol';

export const ASR_URL = 'wss://api.meta.ai/v1/asr/realtime';
export const ASR_MODEL = 'muse-voice-transcribe-1.0';
/** Voice Transcribe takes language names, not codes. */
export const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', hi: 'Hindi', es: 'Spanish' };

export interface AsrSink { partial(text: string): void; final(text: string): void; error(message: string): void; }
export interface AsrRelay { push(pcm16k: Uint8Array): void; end(): void; close(): void; }
export interface AsrOptions { apiKey: string; locales: Locale[]; keywords: string[]; url?: string; }

/** The first text frame (docs: within 10 s of connecting). ENDPOINTING = the model decides when a turn ends. */
export function handshake(o: AsrOptions) {
  // The provider rejects the whole stream if even one screen-label hint exceeds 30 characters.
  const keywords = o.keywords.map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0 && Array.from(keyword).length <= 30).slice(0, 50);
  return { authorization: { accessToken: `Bearer ${o.apiKey}` }, audioEncoding: 'PCM_16KHZ', model: ASR_MODEL,
    mode: 'ENDPOINTING', partialMode: 'CUMULATIVE', emitAudioProgress: false,
    languageBias: o.locales.map((locale) => LANGUAGE_NAMES[locale]), keywords };
}

/**
 * Relays one utterance: audio in, partial/final transcripts out. Audio pushed before the socket opens is
 * buffered (max 5 s, the API's backlog limit). The first speechComplete is the final; the stream then ends.
 */
export function openAsrRelay(o: AsrOptions, sink: AsrSink): AsrRelay {
  const socket = new WebSocket(o.url ?? ASR_URL, { handshakeTimeout: 5_000 });
  const buffered: Uint8Array[] = [];
  let bufferedBytes = 0, ended = false, finished = false;
  const release = () => { buffered.length = 0; bufferedBytes = 0; };
  const close = () => { finished = true; release(); socket.close(1000); };
  const fail = (message: string) => {
    if (finished) return;
    close();
    sink.error(message);
  };
  const eventSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('transcript'), transcript: z.string().max(2000) }),
    z.object({ type: z.literal('speechComplete'), transcript: z.string().max(2000) }),
    z.object({ type: z.literal('error'), message: z.string().optional() }),
  ]);
  socket.on('open', () => {
    if (finished) return;
    socket.send(JSON.stringify(handshake(o)));
    for (const chunk of buffered) socket.send(chunk);
    release();
    if (ended) socket.send(JSON.stringify({ type: 'endStream' }));
  });
  socket.on('message', (data, binary) => {
    if (finished) return;
    let json: unknown;
    try { json = JSON.parse(data.toString()); } catch { fail('invalid asr response'); return; }
    if (binary) { fail('invalid asr response'); return; }
    const envelope = z.object({ type: z.string() }).safeParse(json);
    if (!envelope.success) {
      if (z.object({ sessionId: z.string().min(1), type: z.undefined().optional() }).safeParse(json).success) return;
      fail('invalid asr response');
      return;
    }
    if (!['transcript', 'speechComplete', 'error'].includes(envelope.data.type)) return;
    const event = eventSchema.safeParse(json);
    if (!event.success) {
      fail('invalid asr response');
      return;
    }
    if (event.data.type === 'transcript') sink.partial(event.data.transcript);
    else if (event.data.type === 'speechComplete') { close(); sink.final(event.data.transcript); }
    else fail(event.data.message ?? 'asr failed');
  });
  socket.on('error', () => fail('asr connection failed'));
  socket.on('close', (code) => fail(code === 1013 ? 'asr busy' : 'asr closed before completion'));
  return {
    push(chunk) {
      if (finished || ended) return;
      if (socket.readyState === WebSocket.OPEN) socket.send(chunk);
      else if (socket.readyState === WebSocket.CONNECTING && bufferedBytes + chunk.length <= 160_000) {
        buffered.push(chunk.slice()); bufferedBytes += chunk.length;
      }
    },
    end() {
      if (finished || ended) return;
      ended = true;
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'endStream' }));
    },
    close() { if (!finished) close(); },
  };
}
