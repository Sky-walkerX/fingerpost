import { afterEach, expect, test, vi } from 'vitest';
import { WebSocketServer, type WebSocket } from 'ws';
import { handshake, openAsrRelay } from '../src/asr/relay.ts';

let server: WebSocketServer | undefined;
afterEach(async () => {
  for (const client of server?.clients ?? []) client.terminate();
  await new Promise<void>((resolve) => server ? server.close(() => resolve()) : resolve());
  server = undefined;
});
async function fake(onConnect: (socket: WebSocket) => void) {
  server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise<void>((resolve) => server!.once('listening', resolve));
  server.on('connection', onConnect);
  return `ws://127.0.0.1:${(server.address() as { port: number }).port}`;
}
function sink() {
  let finish!: () => void;
  const done = new Promise<void>((resolve) => { finish = resolve; });
  return { done, partial: vi.fn(), final: vi.fn(() => finish()), error: vi.fn(() => finish()) };
}

test('handshake caps keywords at 50 without mutating options', () => {
  const keywords = Array.from({ length: 51 }, (_, i) => `Synthetic ${i}`);
  const result = handshake({ apiKey: 'synthetic', locales: ['en', 'hi', 'es'], keywords });
  expect(result.languageBias).toEqual(['English', 'Hindi', 'Spanish']); expect(result.keywords).toHaveLength(50); expect(keywords).toHaveLength(51);
});

test('pre-open audio is capped at five seconds and post-end audio is ignored', async () => {
  let bytes = 0;
  const url = await fake((ws) => ws.on('message', (data, binary) => {
    if (binary) bytes += (data as Buffer).length;
    else if (JSON.parse(data.toString()).type === 'endStream') ws.send(JSON.stringify({ type: 'speechComplete', transcript: 'start' }));
  }));
  const out = sink(); const relay = openAsrRelay({ apiKey: 'synthetic', locales: ['en'], keywords: [], url }, out);
  for (let i = 0; i < 51; i++) relay.push(new Uint8Array(3200));
  relay.end(); relay.end(); relay.push(new Uint8Array(640)); await out.done;
  expect(bytes).toBe(160_000); expect(out.final).toHaveBeenCalledExactlyOnceWith('start'); expect(out.error).not.toHaveBeenCalled();
});

test('valid acknowledgement is ignored and duplicate finals cannot complete twice', async () => {
  const url = await fake((ws) => ws.once('message', () => {
    ws.send(JSON.stringify({ sessionId: 'synthetic-session' }));
    ws.send(JSON.stringify({ type: 'speechComplete', transcript: 'start' }));
    ws.send(JSON.stringify({ type: 'speechComplete', transcript: 'stale' }));
  }));
  const out = sink(); openAsrRelay({ apiKey: 'synthetic', locales: ['en'], keywords: [], url }, out); await out.done;
  expect(out.final).toHaveBeenCalledExactlyOnceWith('start'); expect(out.error).not.toHaveBeenCalled();
});

test('endpointing lifecycle and unknown future events do not terminate the transcript stream', async () => {
  const url = await fake((ws) => ws.once('message', () => {
    ws.send(JSON.stringify({ type: 'speechStart', turnId: 1, audioProcessedMs: 20 }));
    ws.send(JSON.stringify({ type: 'transcript', transcript: 'start', final: false }));
    ws.send(JSON.stringify({ type: 'speechEnd', turnId: 1, audioProcessedMs: 40 }));
    ws.send(JSON.stringify({ type: 'futureEvent' }));
    ws.send(JSON.stringify({ type: 'speechComplete', transcript: 'Start.' }));
  }));
  const out = sink(); openAsrRelay({ apiKey: 'synthetic', locales: ['en'], keywords: [], url }, out); await out.done;
  expect(out.partial).toHaveBeenCalledExactlyOnceWith('start'); expect(out.final).toHaveBeenCalledExactlyOnceWith('Start.'); expect(out.error).not.toHaveBeenCalled();
});

test('invalid provider JSON produces exactly one error and no transcript', async () => {
  const url = await fake((ws) => ws.once('message', () => { ws.send('{'); ws.close(1011); }));
  const out = sink(); openAsrRelay({ apiKey: 'synthetic', locales: ['en'], keywords: [], url }, out); await out.done;
  expect(out.error).toHaveBeenCalledTimes(1); expect(out.partial).not.toHaveBeenCalled(); expect(out.final).not.toHaveBeenCalled();
});

test('local cancellation suppresses later transcript/error delivery', async () => {
  let connected!: () => void; const opened = new Promise<void>((resolve) => { connected = resolve; });
  const url = await fake((ws) => ws.once('message', connected));
  const out = sink(); const relay = openAsrRelay({ apiKey: 'synthetic', locales: ['en'], keywords: [], url }, out);
  await opened; relay.close(); relay.close(); relay.push(new Uint8Array(640)); relay.end();
  await new Promise<void>((resolve) => [...server!.clients][0]!.once('close', () => resolve()));
  expect(out.error).not.toHaveBeenCalled(); expect(out.final).not.toHaveBeenCalled();
});
