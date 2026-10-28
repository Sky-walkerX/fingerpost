import { z } from 'zod';

/** The debug boundary carries metrics only, never layout or model response content. */
export const LatencyMetrics = z.strictObject({
  sparkMs: z.number().finite().nonnegative(),
  samMs: z.number().finite().nonnegative(),
  elements: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
});
