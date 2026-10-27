import WebSocket from 'ws';
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
  throw new Error('TODO(D2-T7): implement this; the tests describe the behaviour');
}

/**
 * Relays one utterance: audio in, partial/final transcripts out. Audio pushed before the socket opens is
 * buffered (max 5 s, the API's backlog limit). The first speechComplete is the final; the stream then ends.
 */
export function openAsrRelay(o: AsrOptions, sink: AsrSink): AsrRelay {
  throw new Error('TODO(D2-T7): implement this; the tests describe the behaviour');
}
