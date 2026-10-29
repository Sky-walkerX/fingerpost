import type { TouchEvent } from './model.ts';

export interface PostOptions { gatewayUrl: string; token?: string; fetchImpl?: typeof fetch; timeoutMs?: number; }

/** Fire-and-forget POST to the gateway's /v1/sim/events. Never throws: the sim must keep working offline. */
export async function postTouch(ev: TouchEvent, o: PostOptions): Promise<boolean> {
  const { pointerId: _pointer, ...body } = ev;
  try {
    const res = await (o.fetchImpl ?? fetch)(new URL('/v1/sim/events', o.gatewayUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(o.token ? { 'x-sim-token': o.token } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(o.timeoutMs ?? 2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
