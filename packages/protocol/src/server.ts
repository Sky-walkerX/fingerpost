import { z } from 'zod';
import { base, ElementRole, ErrorCode, Id, Intent, Polygon, Priority, Quad, ScreenType, SessionMode, Sensitivity, Unit } from './common.ts';

const Say = z.string().min(1).max(500);

export const LayoutElement = z.object({
  id: z.string().min(1).max(32),
  label: z.string().min(1).max(200),
  labelLocal: z.string().max(200).optional(),
  role: ElementRole,
  state: z.string().max(50).optional(),
  polygon: Polygon,
  textNorm: z.string().max(200).optional(),
  confidence: Unit,
});
export const Ready = z.object({
  ...base,
  type: z.literal('ready'),
  sessionId: Id,
  quota: z.object({ tasksLeft: z.number().int().nonnegative() }),
  flags: z.object({ cloudEnabled: z.boolean(), privateAvailable: z.boolean(), modelWaitMs: z.number().int().min(6000).max(65_000).optional() }),
});
export const Transcript = z.object({ ...base, type: z.literal('transcript'), final: z.boolean(), text: z.string().max(2000) });
export const GoalAck = z.object({ ...base, type: z.literal('goal.ack'), goal: z.string().min(1).max(500), intent: Intent });
export const Layout = z.object({
  ...base,
  type: z.literal('layout'),
  fingerprint: z.string().max(64),
  screenType: ScreenType,
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  language: z.string().min(2).max(16),
  sensitivity: Sensitivity,
  screenQuad: Quad.optional(),
  elements: z.array(LayoutElement).max(200),
  source: z.enum(['memory', 'model']),
});
export const Target = z.object({ ...base, type: z.literal('target'), elementId: z.string().min(1).max(32), polygon: Polygon, confidence: Unit, say: Say });
export const SayMsg = z.object({ ...base, type: z.literal('say'), text: Say, priority: Priority });
/** `reframe`: the picture was unusable (no screen plane, button too small); the client may re-frame and resend once. */
export const AskReason = z.enum(['reframe']);
export const Ask = z.object({ ...base, type: z.literal('ask'), question: z.string().min(1).max(300), options: z.array(z.string().min(1).max(100)).max(8),
  reason: AskReason.optional() });
export const Confirm = z.object({
  ...base,
  type: z.literal('confirm'),
  summary: z.string().min(1).max(300),
  amount: z.object({ value: z.number().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/) }).optional(),
});
export const Expect = z.object({ ...base, type: z.literal('expect'), description: z.string().min(1).max(300) });
export const Verify = z.object({
  ...base,
  type: z.literal('verify'),
  re: Id,
  result: z.enum(['ok', 'wrong', 'nochange']),
  actualElementId: z.string().min(1).max(32).optional(),
  say: Say,
});
export const ModeMsg = z.object({ ...base, type: z.literal('mode'), mode: SessionMode, reason: z.string().max(200) });
export const Quota = z.object({ ...base, type: z.literal('quota'), tasksLeft: z.number().int().nonnegative() });
export const Finish = z.object({ ...base, type: z.literal('finish'), result: z.enum(['done', 'aborted', 'failed']), say: Say });
export const ErrorMsg = z.object({ ...base, type: z.literal('error'), code: ErrorCode, retryable: z.boolean(), say: Say });
export const SimTouch = z.object({
  ...base,
  type: z.literal('sim.touch'),
  runId: Id,
  screenId: z.string().min(1).max(64),
  x: z.number(),
  y: z.number(),
  u: Unit,
  v: Unit,
  elementId: z.string().min(1).max(64).nullable(),
});

export const ServerMessage = z.discriminatedUnion('type', [
  Ready, Transcript, GoalAck, Layout, Target, SayMsg, Ask, Confirm, Expect, Verify, ModeMsg, Quota, Finish, ErrorMsg, SimTouch,
]);
export type ServerMessage = z.infer<typeof ServerMessage>;
export type Layout = z.infer<typeof Layout>;
export type LayoutElement = z.infer<typeof LayoutElement>;
