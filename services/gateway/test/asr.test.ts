import { afterEach, expect, test } from 'vitest';
import { WebSocketServer, type WebSocket } from 'ws';
import { handshake, openAsrRelay } from '../src/asr/relay.ts';

let server: WebSocketServer | undefined;
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

/** A fake Voice Transcribe: records what it receives and lets the test script replies. */
function fakeAsr(onConnect: (ws: WebSocket, got: { text: string[]; binary: number[] }) => void) {
  return new Promise<string>((resolve) => {
    server = new WebSocketServer({ port: 0 }, () => resolve(`ws://127.0.0.1:${(server!.address() as { port: number }).port}`));
    server.on('connection', (ws) => {
      const got = { text: [] as string[], binary: [] as number[] };
      ws.on('message', (d, isBinary) => (isBinary ? got.binary.push((d as Buffer).length) : got.text.push(d.toString())));
      onConnect(ws, got);
    });
  });
}
const sinkInto = () => {
  const out = { partials: [] as string[], finals: [] as string[], errors: [] as string[] };
  let done!: () => void; const finished = new Promise<void>((r) => (done = r));
  return { out, finished, sink: { partial: (t: string) => out.partials.push(t), final: (t: string) => { out.finals.push(t); done(); }, error: (e: string) => { out.errors.push(e); done(); } } };
};

test('handshake uses ENDPOINTING, PCM_16KHZ, language names and screen keywords', () => {
  expect(handshake({ apiKey: 'k', locales: ['en', 'hi'], keywords: ['Start', 'Timer'] })).toEqual({
    authorization: { accessToken: 'Bearer k' }, audioEncoding: 'PCM_16KHZ', model: 'muse-voice-transcribe-1.0', mode: 'ENDPOINTING',
    partialMode: 'CUMULATIVE', emitAudioProgress: false, languageBias: ['English', 'Hindi'], keywords: ['Start', 'Timer'],
  });
});

test('sends handshake first, then buffered audio, then endStream; maps partials and the final', async () => {
  let got!: { text: string[]; binary: number[] };
  const url = await fakeAsr((ws, g) => {
    got = g;
    ws.on('message', (_d, isBinary) => {
      if (!isBinary && g.text.length === 2) { // handshake + endStream received
        ws.send(JSON.stringify({ type: 'transcript', transcript: 'press', final: false }));
        ws.send(JSON.stringify({ type: 'transcript', transcript: 'press start', final: false }));
        ws.send(JSON.stringify({ type: 'speechComplete', turnId: 1, transcript: 'Press start.' }));
      }
    });
  });
  const { out, finished, sink } = sinkInto();
  const relay = openAsrRelay({ apiKey: 'k', locales: ['en'], keywords: [], url }, sink);
  relay.push(new Uint8Array(640)); relay.push(new Uint8Array(640)); // before open → buffered
  relay.end();
  await finished;
  expect(JSON.parse(got.text[0]!)).toMatchObject({ mode: 'ENDPOINTING' });
  expect(got.binary).toEqual([640, 640]);
  expect(JSON.parse(got.text[1]!)).toEqual({ type: 'endStream' });
  expect(out).toEqual({ partials: ['press', 'press start'], finals: ['Press start.'], errors: [] });
});

test('server error event → sink.error, once', async () => {
  const url = await fakeAsr((ws) => ws.once('message', () => ws.send(JSON.stringify({ type: 'error', message: 'bad key', sessionId: 's' }))));
  const { out, finished, sink } = sinkInto();
  openAsrRelay({ apiKey: 'bad', locales: ['en'], keywords: [], url }, sink);
  await finished;
  expect(out.errors).toEqual(['bad key']);
});

test('close code 1013 (capacity) is reported as busy', async () => {
  const url = await fakeAsr((ws) => ws.close(1013));
  const { out, finished, sink } = sinkInto();
  openAsrRelay({ apiKey: 'k', locales: ['en'], keywords: [], url }, sink);
  await finished;
  expect(out.errors).toEqual(['asr busy']);
});
