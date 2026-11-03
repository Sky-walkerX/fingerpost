import { afterEach, expect, test, vi } from 'vitest';
import type { ServerMessage } from '@fingerpost/protocol';
import { SessionHub } from '../src/session/hub.ts';
import { CachedMinVersionSource, MemoryMinVersionSource } from '../src/min-version/source.ts';
import { RemoteConfigMinVersionSource } from '../src/min-version/remote-config-source.ts';

afterEach(() => vi.useRealTimers());
const hello = (appVersion: string) => JSON.stringify({ type: 'hello', id: 'h', ts: 1, appVersion,
  protocol: 'fp.v1', locale: 'en', mode: 'guide', privacy: 'normal', caps: {} });

test('the minimum-version boundary rejects an old app before hello handlers, ready or any work', async () => {
  const sent: ServerMessage[] = [], onHello = vi.fn(), onMessage = vi.fn(), onVersionUnsupported = vi.fn();
  const minimum = new MemoryMinVersionSource('1.2.0');
  const hub = new SessionHub({ send: m => sent.push(m), minimumVersion: () => minimum.getMinVersion(),
    handlers: { onHello, onMessage, onVersionUnsupported } });
  await hub.onText(hello('1.1.9'));
  await hub.onText(JSON.stringify({ type: 'goal', id: 'g', ts: 1, text: 'Synthetic goal', source: 'typed' }));
  expect(onHello).not.toHaveBeenCalled(); expect(onMessage).not.toHaveBeenCalled();
  expect(onVersionUnsupported).toHaveBeenCalledTimes(1);
  expect(sent).toMatchObject([{ type: 'error', code: 'version_unsupported' }, { type: 'error', code: 'bad_message' }]);
  await hub.onText(hello('1.2.0')); expect(sent.at(-1)).toMatchObject({ type: 'ready' });
  expect(onHello).toHaveBeenCalledTimes(1);
});

test('a later retirement invalidates the previous hello and cancels its controller context', async () => {
  const source = new MemoryMinVersionSource('1.0.0'), onMessage = vi.fn(), stop = vi.fn();
  const hub = new SessionHub({ send: () => {}, minimumVersion: () => source.getMinVersion(),
    handlers: { onMessage, onVersionUnsupported: stop } });
  await hub.onText(hello('1.0.0')); source.version = '2.0.0'; await hub.onText(hello('1.0.0'));
  await hub.onText(JSON.stringify({ type: 'goal', id: 'g', ts: 1, text: 'Synthetic goal', source: 'typed' }));
  expect(stop).toHaveBeenCalledTimes(1); expect(onMessage).not.toHaveBeenCalled();
});

test('invalid Remote Config strings cannot replace a valid retirement policy', async () => {
  let value = '1.2.3';
  const source = new RemoteConfigMinVersionSource({ getTemplate: async () => ({ parameters: { min_supported_version: { defaultValue: { value } } } }) });
  expect(await source.getMinVersion()).toBe('1.2.3');
  for (const invalid of ['garbage', '1.2', '1.02.3', '2147483648.0.0', '1.0.0-01']) {
    value = invalid; expect(await source.getMinVersion()).toBe('1.2.3');
  }
});

test('cached refresh coalesces callers, bounds a stalled provider and ignores its late result', async () => {
  vi.useFakeTimers();
  let resolve!: (value: string) => void;
  const read = vi.fn(() => new Promise<string>(r => { resolve = r; }));
  const source = new CachedMinVersionSource({ getMinVersion: read });
  const calls = Array.from({ length: 20 }, () => source.getMinVersion());
  await vi.advanceTimersByTimeAsync(5000);
  expect(await Promise.all(calls)).toEqual(Array(20).fill('0.1.0'));
  expect(read).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(31_000); expect(await source.getMinVersion()).toBe('0.1.0');
  expect(read).toHaveBeenCalledTimes(1);
  resolve('9.0.0'); await vi.advanceTimersByTimeAsync(0);
  expect(await source.getMinVersion()).toBe('0.1.0');
});
