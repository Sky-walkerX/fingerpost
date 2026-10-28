import { z } from 'zod';
import { ServerMessage } from '@fingerpost/protocol';
import { LatencyMetrics } from './latency-metrics.ts';

export const BenchmarkAuth = z.strictObject({ authenticated: z.literal(true), mode: z.enum(['mock', 'live']) });
export const AsrMetrics = z.strictObject({
  mode: z.enum(['mock', 'live']), connectMs: z.number().finite().nonnegative(), readyMs: z.number().finite().nonnegative(),
}).refine((value) => value.readyMs >= value.connectMs);
export const TargetTimings = LatencyMetrics.extend({ samRefined: z.number().int().min(0).max(1) });
/** Private developer envelope; the nested message is the unchanged fp.v1 contract. */
export const BenchmarkEnvelope = z.strictObject({ message: ServerMessage, timings: TargetTimings.optional() });
