import type { TouchEvent } from './model.ts';

export interface PostOptions { gatewayUrl: string; token?: string; fetchImpl?: typeof fetch; timeoutMs?: number; }

/** Fire-and-forget POST to the gateway's /v1/sim/events. Never throws: the sim must keep working offline. */
export async function postTouch(ev: TouchEvent, o: PostOptions): Promise<boolean> {
  throw new Error('TODO(D2-T9): implement this; the tests describe the behaviour');
}
