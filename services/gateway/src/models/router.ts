import type { Sensitivity } from '@fingerpost/protocol';
import type { z } from 'zod';
import type { ModelPort } from './port.ts';

type SensitivityValue = z.infer<typeof Sensitivity>;

/** The user asked for private mode and no private model (Glimmer on Modal) is configured or reachable. */
export class PrivateUnavailable extends Error {
  constructor() { super('Private models are not available'); this.name = 'PrivateUnavailable'; }
}

export interface RoutedModels {
  /** Which models read this session's next frame. Throws PrivateUnavailable for a private session without Glimmer. */
  forSession(privacy: 'normal' | 'private', sensitivity: SensitivityValue): ModelPort;
  readonly privateAvailable: boolean;
}

/**
 * Days 4–7 plan, B4-1 (design §4.4). A private session never touches the Meta API. A screen the gateway
 * marked financial or identity sends later frames to Glimmer when it is configured; without Glimmer those
 * frames stay on Meta Standard mode, because the PIN/payment gate already blocks secrets on the device and
 * refusing would end the user's task mid-payment. Spark 1.3 → 1.2 fallback lives in liveModels.
 */
export function createRouter(o: { meta: ModelPort; glimmer?: ModelPort | undefined }): RoutedModels {
  return {
    privateAvailable: !!o.glimmer,
    forSession(privacy, sensitivity) {
      if (privacy === 'private') {
        if (!o.glimmer) throw new PrivateUnavailable();
        return o.glimmer;
      }
      if (sensitivity !== 'none' && o.glimmer) return o.glimmer;
      return o.meta;
    },
  };
}
