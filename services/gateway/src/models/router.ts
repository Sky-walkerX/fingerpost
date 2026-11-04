import OpenAI from 'openai';
import type { Sensitivity } from '@fingerpost/protocol';
import type { z } from 'zod';
import { Breaker } from './breaker.ts';
import { sparkFallbackWorthy, type ModelPort } from './port.ts';

type SensitivityValue = z.infer<typeof Sensitivity>;

/** The user asked for private mode and no private model (Glimmer on Modal) is configured or reachable. */
export class PrivateUnavailable extends Error {
  constructor() { super('Private models are not available'); this.name = 'PrivateUnavailable'; }
}

/** Every step of the fallback chain failed (design §4.4): the session switches to offline basic mode. */
export class ModelsUnavailable extends Error {
  constructor() { super('Models are not available'); this.name = 'ModelsUnavailable'; }
}

/** Spoken when the chain ends (Days 4–7 plan, B5-3). */
export const OFFLINE_SAY = 'Cloud features are paused; basic mode still works.';

export interface RoutedModels {
  /** Which models read this session's next frame. Throws PrivateUnavailable for a private session without Glimmer. */
  forSession(privacy: 'normal' | 'private', sensitivity: SensitivityValue): ModelPort;
  readonly privateAvailable: boolean;
}

export interface RouterOptions {
  meta: ModelPort;
  glimmer?: ModelPort | undefined;
  breaker?: Breaker;
  /** Glimmer scales to zero on Modal; a cold start is too slow to be a fallback. Default: warm when configured. */
  glimmerWarm?: () => boolean;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

/** A blip worth one quick retry: a connection drop or a 5xx. Not a timeout (it already waited the full budget). */
const retryWorthy = (error: unknown) =>
  !(error instanceof OpenAI.APIConnectionTimeoutError) && (error instanceof OpenAI.APIConnectionError || sparkFallbackWorthy(error));

/**
 * Days 4–7 plan, B4-1 + B5-3 (design §4.4). Routing: a private session never touches the Meta API; a screen
 * marked financial or identity sends later frames to Glimmer, refusing when it is unavailable.
 * Resilience on the Meta path: Spark 1.3 → 1.2 (inside liveModels, hedged after 15 s) → one jittered retry (200–600 ms) →
 * warm Glimmer → ModelsUnavailable, which the session turns into offline mode. A breaker (5 failures in
 * 30 s, 20 s open) stops hammering a provider that is down.
 */
export function createRouter(o: RouterOptions): RoutedModels {
  const breaker = o.breaker ?? new Breaker();
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = o.random ?? Math.random;
  const warm = o.glimmerWarm ?? (() => true);

  async function resilient<T>(call: (port: ModelPort) => Promise<T>, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted();
    if (breaker.allow()) {
      try {
        const result = await call(o.meta);
        breaker.success();
        return result;
      } catch (error) {
        signal?.throwIfAborted();
        let failed = true;
        let result: T | undefined;
        if (retryWorthy(error)) {
          await sleep(Math.round(200 + random() * 400));
          signal?.throwIfAborted();
          try { result = await call(o.meta); failed = false; } catch { /* counted below */ }
          signal?.throwIfAborted();
        }
        if (!failed) { breaker.success(); return result as T; }
        breaker.failure();
      }
    }
    signal?.throwIfAborted();
    if (o.glimmer && warm()) return call(o.glimmer);
    throw new ModelsUnavailable();
  }

  const metaPath: ModelPort = {
    parseScreen: (img, opts) => resilient((p) => p.parseScreen(img, opts), opts.signal),
    segmentByBox: (img, box) => resilient((p) => p.segmentByBox(img, box), img.signal),
    segmentByText: (img, phrase) => resilient((p) => p.segmentByText(img, phrase), img.signal),
    ...(o.meta.groundControl ? { groundControl: (img, opts) => resilient((p) => {
      if (!p.groundControl) throw new ModelsUnavailable();
      return p.groundControl(img, opts);
    }, img.signal) } satisfies Pick<ModelPort, 'groundControl'> : {}),
  };

  return {
    privateAvailable: !!o.glimmer,
    forSession(privacy, sensitivity) {
      if (privacy === 'private' || sensitivity !== 'none') {
        if (!o.glimmer) throw new PrivateUnavailable();
        return o.glimmer;
      }
      return metaPath;
    },
  };
}
