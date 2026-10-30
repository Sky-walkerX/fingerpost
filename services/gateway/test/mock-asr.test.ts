import { afterEach, expect, test, vi } from 'vitest';
import { mockAsr } from '../src/models/mock/mock-asr.ts';
afterEach(() => vi.useRealTimers());

const sink = () => ({ partial: vi.fn(), final: vi.fn(), error: vi.fn() });
const options = { locales: ['en' as const], keywords: [] };

test('mock endpointing completes from audio without waiting for the phone to stop its microphone', async () => {
  vi.useFakeTimers(); const output = sink(), relay = mockAsr('boil')(options, output);
  relay.push(new Uint8Array(640)); await vi.advanceTimersByTimeAsync(5);
  expect(output.final).toHaveBeenCalledExactlyOnceWith('boil');
  expect(output.partial).toHaveBeenCalledExactlyOnceWith('boil');
  relay.end(); relay.push(new Uint8Array(640)); await vi.advanceTimersByTimeAsync(10);
  expect(output.final).toHaveBeenCalledTimes(1);
});

test('closing a mock utterance suppresses pending endpointing and later end calls', async () => {
  vi.useFakeTimers(); const output = sink(), relay = mockAsr()(options, output);
  relay.push(new Uint8Array(640)); relay.close(); relay.end(); await vi.advanceTimersByTimeAsync(10);
  expect(output.final).not.toHaveBeenCalled(); expect(output.partial).not.toHaveBeenCalled();
});

test('explicit end remains supported and repeated end signals emit one final', async () => {
  vi.useFakeTimers(); const output = sink(), relay = mockAsr()(options, output);
  relay.end(); relay.end(); await vi.advanceTimersByTimeAsync(10);
  expect(output.final).toHaveBeenCalledExactlyOnceWith('start');
});
