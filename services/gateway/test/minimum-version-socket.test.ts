import { expect, test, vi } from 'vitest';
import type { ServerMessage } from '@fingerpost/protocol';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { MemoryMinVersionSource } from '../src/min-version/source.ts';
import { mockModels } from '../src/models/mock/mock-models.ts';

test('config and real socket admission share cached policy and refuse retired clients before models', async () => {
  let now = 1_000;
  const source = new MemoryMinVersionSource('1.0.0'), models = mockModels();
  const parse = vi.spyOn(models, 'parseScreen');
  const app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }), { minVersionSource: source, models, now: () => now });
  await app.ready();
  const ws = await app.injectWS('/v1/session');
  const received: ServerMessage[] = [];
  ws.on('message', (data: Buffer) => received.push(JSON.parse(data.toString()) as ServerMessage));
  const hello = (appVersion: string) => ws.send(JSON.stringify({ type: 'hello', id: 'h', ts: now,
    protocol: 'fp.v1', appVersion, locale: 'en', mode: 'guide', privacy: 'normal', caps: {} }));
  try {
    expect((await app.inject('/v1/config')).json()).toMatchObject({ minVersion: '1.0.0' });
    hello('0.1.0');
    await vi.waitFor(() => expect(received).toMatchObject([{ type: 'error', code: 'version_unsupported' }]));
    ws.send(JSON.stringify({ type: 'goal', id: 'g', ts: now, text: 'Synthetic goal', source: 'typed' }));
    await vi.waitFor(() => expect(received.at(-1)).toMatchObject({ type: 'error', code: 'bad_message' }));
    expect(parse).not.toHaveBeenCalled(); expect(source.reads).toBe(1);
    received.length = 0; hello('1.0.0');
    await vi.waitFor(() => expect(received.at(-1)).toMatchObject({ type: 'ready' }));
    source.version = '2.0.0'; now += 30_001; received.length = 0; hello('1.0.0');
    await vi.waitFor(() => expect(received.at(-1)).toMatchObject({ type: 'error', code: 'version_unsupported' }));
    expect((await app.inject('/v1/config')).json()).toMatchObject({ minVersion: '2.0.0' });
    expect(source.reads).toBe(2); expect(parse).not.toHaveBeenCalled();
  } finally { ws.terminate(); await app.close(); }
});
