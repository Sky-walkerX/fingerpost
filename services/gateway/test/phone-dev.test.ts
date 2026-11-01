import { afterEach, expect, test, vi } from 'vitest';
import { once } from 'node:events';
import { parseServerMessage } from '@fingerpost/protocol';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { buildPhoneGateway, phoneDevConfig, restoreUsbForwarding, watchUsbForwarding } from '../scripts/phone-dev.ts';

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

test('restores the missing USB port without changing unrelated forwards', async () => {
  const run = vi.fn().mockResolvedValueOnce('device\n')
    .mockResolvedValueOnce('synthetic-private-device tcp:5173 tcp:5173\n').mockResolvedValueOnce('');
  expect(await restoreUsbForwarding(run)).toBe('ready');
  expect(run.mock.calls).toEqual([
    [['-d', 'get-state']], [['-d', 'reverse', '--list']],
    [['-d', 'reverse', 'tcp:8080', 'tcp:8080']],
  ]);
});

test('retains an existing correct USB mapping', async () => {
  const run = vi.fn().mockResolvedValueOnce('device\n')
    .mockResolvedValueOnce('synthetic-private-device tcp:8080 tcp:8080\n');
  expect(await restoreUsbForwarding(run)).toBe('ready');
  expect(run).toHaveBeenCalledTimes(2);
});

test('repairs a mapping to the wrong laptop port', async () => {
  const run = vi.fn().mockResolvedValueOnce('device\n')
    .mockResolvedValueOnce('synthetic-private-device tcp:8080 tcp:9000\n').mockResolvedValueOnce('');
  expect(await restoreUsbForwarding(run)).toBe('ready');
  expect(run).toHaveBeenLastCalledWith(['-d', 'reverse', 'tcp:8080', 'tcp:8080']);
});

test.each(['offline', 'unauthorized', 'unknown'])('does not touch forwarding on %s phones', async (state) => {
  const run = vi.fn().mockResolvedValue(`${state}\n`);
  expect(await restoreUsbForwarding(run)).toBe('waiting');
  expect(run).toHaveBeenCalledTimes(1);
});

test('absent, multiple or inaccessible USB phones produce a generic waiting state', async () => {
  const run = vi.fn().mockRejectedValue(new Error('synthetic-private-device: more than one device'));
  expect(await restoreUsbForwarding(run)).toBe('waiting');
  expect(run).toHaveBeenCalledTimes(1);
});

test('forwarding errors do not escape device identifiers or raw adb output', async () => {
  const run = vi.fn().mockResolvedValueOnce('device\n')
    .mockResolvedValueOnce('').mockRejectedValueOnce(new Error('synthetic-private-device: failure'));
  expect(await restoreUsbForwarding(run)).toBe('forwarding_failed');
});

test('phone gateway stays mock and unauthenticated regardless of live shell credentials', () => {
  vi.stubEnv('MODEL_MODE', 'live'); vi.stubEnv('AUTH_REQUIRED', 'true');
  vi.stubEnv('META_API_KEY', 'synthetic-private-key'); vi.stubEnv('SIM_TOKEN', 'synthetic-private-token');
  const config = phoneDevConfig();
  expect(config).toEqual(loadConfig({ MODEL_MODE: 'mock', AUTH_REQUIRED: 'false', LOG_LEVEL: 'silent', GIT_SHA: 'phone-dev' }));
  expect(config.META_API_KEY).toBeUndefined(); expect(config.SIM_TOKEN).toBeUndefined();
});

test('--live uses only the key and model settings from .env, with auth off', () => {
  vi.stubEnv('LOG_LEVEL', 'trace'); vi.stubEnv('META_API_KEY', 'shell-key-ignored');
  const config = phoneDevConfig({ live: true, env: { META_API_KEY: 'synthetic-private-key', MODEL_TIMEOUT_MS: '25000', DEBUG_TOKEN: 'synthetic-debug-token-123', PORT: '9999' } });
  expect(config).toMatchObject({ MODEL_MODE: 'live', META_API_KEY: 'synthetic-private-key', MODEL_TIMEOUT_MS: 25_000, AUTH_REQUIRED: false, ALLOW_UNAUTHENTICATED_LIVE: true, PORT: 8080 });
  expect(config.DEBUG_TOKEN).toBeUndefined();
});

test('--live without a key fails instead of silently falling back to mock', () => {
  expect(() => phoneDevConfig({ live: true, env: {} })).toThrow(/META_API_KEY/);
});

test('watcher restores the route after a disconnect and stops polling on shutdown', async () => {
  vi.useFakeTimers();
  const run = vi.fn().mockResolvedValue('');
  const connect = () => run.mockResolvedValueOnce('device\n').mockResolvedValueOnce('').mockResolvedValueOnce('');
  connect();
  const states: string[] = [];
  const stop = watchUsbForwarding(run, (state) => states.push(state));
  await vi.advanceTimersByTimeAsync(0);
  expect(states).toEqual(['ready']);
  run.mockRejectedValueOnce(new Error('synthetic disconnect'));
  await vi.advanceTimersByTimeAsync(2_000);
  expect(states).toEqual(['ready', 'waiting']);
  connect();
  await vi.advanceTimersByTimeAsync(2_000);
  expect(states).toEqual(['ready', 'waiting', 'ready']);
  expect(run.mock.calls.filter(([args]) => args.join(' ') === '-d reverse tcp:8080 tcp:8080')).toHaveLength(2);
  await stop();
  const count = run.mock.calls.length;
  await vi.advanceTimersByTimeAsync(10_000);
  expect(run).toHaveBeenCalledTimes(count);
});

test('stopping during an adb operation suppresses late reports and future polls', async () => {
  vi.useFakeTimers();
  let resolve!: (state: string) => void;
  const run = vi.fn().mockReturnValue(new Promise<string>((done) => { resolve = done; }));
  const report = vi.fn();
  const stop = watchUsbForwarding(run, report);
  const stopped = stop();
  resolve('offline');
  await stopped;
  await vi.advanceTimersByTimeAsync(10_000);
  expect(report).not.toHaveBeenCalled(); expect(run).toHaveBeenCalledTimes(1);
});

test('phone practice gateway announces simulated targets after ready, using the existing speech message', async () => {
  const app = await buildPhoneGateway();
  await app.ready();
  const ws = await app.injectWS('/v1/session');
  try {
    const messages: unknown[] = [];
    ws.on('message', (data: Buffer) => messages.push(JSON.parse(data.toString())));
    const received = once(ws, 'message');
    ws.send(JSON.stringify({ type: 'hello', id: 'synthetic-hello', ts: 1, appVersion: '0.1.0',
      protocol: 'fp.v1', locale: 'en', mode: 'guide', privacy: 'normal', caps: {} }));
    await received;
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ type: 'ready' });
    expect(messages[1]).toMatchObject({ type: 'say', priority: 'safety',
      text: 'Practice mode. Targets are simulated. Do not use these directions on real controls.' });
    expect(messages.map(parseServerMessage).every((message) => message.kind === 'ok')).toBe(true);
  } finally { ws.terminate(); await app.close(); }
});

test('a practice notice cannot be enabled on a live gateway', async () => {
  const app = await buildApp(loadConfig({ MODEL_MODE: 'live', META_API_KEY: 'synthetic-key', AUTH_REQUIRED: 'false',
    ALLOW_UNAUTHENTICATED_LIVE: 'true', LOG_LEVEL: 'silent' }), { mockNotice: 'Synthetic practice notice.' });
  await app.ready();
  const ws = await app.injectWS('/v1/session');
  try {
    const messages: unknown[] = [];
    ws.on('message', (data: Buffer) => messages.push(JSON.parse(data.toString())));
    const received = once(ws, 'message');
    ws.send(JSON.stringify({ type: 'hello', id: 'synthetic-hello', ts: 1, appVersion: '0.1.0',
      protocol: 'fp.v1', locale: 'en', mode: 'guide', privacy: 'normal', caps: {} }));
    await received;
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ type: 'ready' });
  } finally { ws.terminate(); await app.close(); }
});
