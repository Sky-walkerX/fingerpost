import { expect, test } from 'vitest';
import type { ClientMessage } from '@fingerpost/protocol';
import { TransportCounters } from '../src/debug/transport-counters.ts';

const message = (type: ClientMessage['type'], extra: object = {}) => ({ type, id: 'synthetic', ts: 1, ...extra }) as ClientMessage;

test('records only content-free transport counters across the PIN boundary', () => {
  const counters = new TransportCounters();
  counters.record(message('audio'));
  counters.record(message('keyframe'));
  counters.record(message('event', { kind: 'pinModeEntered' }));
  counters.record(message('audio'));
  counters.record(message('audio.end'));
  counters.record(message('keyframe'));
  counters.record(message('event', { kind: 'pinModeExited' }));

  expect(counters.snapshot()).toEqual({
    audioChunks: 2, audioChunksWhilePinActive: 1,
    audioEnds: 1, audioEndsWhilePinActive: 1,
    keyframes: 2, keyframesWhilePinActive: 1,
    pinEntered: 1, pinExited: 1, pinActive: false,
  });
});
