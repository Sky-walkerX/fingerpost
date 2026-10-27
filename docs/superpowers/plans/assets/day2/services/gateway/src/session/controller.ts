import { ulid } from 'ulid';
import type { ServerMessage } from '@fingerpost/protocol';
import type { AsrOptions, AsrRelay, AsrSink } from '../asr/relay.ts';
import type { ModelPort } from '../models/port.ts';
import type { SimRegistry } from '../sim/registry.ts';
import type { QuotaPort, SessionClaims } from './types.ts';
import { SessionHub } from './hub.ts';
import { SessionPipeline } from './pipeline.ts';

export type AsrFactory = (o: Omit<AsrOptions, 'apiKey'>, sink: AsrSink) => AsrRelay;
export interface ControllerDeps {
  send: (m: ServerMessage) => void; models: ModelPort; asr: AsrFactory; sims: SimRegistry; now?: () => number;
  /** Day 3: present when the socket was authenticated. Without it, quotas are not applied (mock/dev). */
  claims?: SessionClaims; quota?: QuotaPort;
}

/** Wires one WebSocket: hub (validation) → pipeline (brain) + ASR relay + sim touches. Returns a disposer. */
export function createSessionController(d: ControllerDeps): { hub: SessionHub; dispose(): void } {
  throw new Error('TODO(D2-T7): implement this; the tests describe the behaviour');
}
