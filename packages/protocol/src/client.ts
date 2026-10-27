import { z } from 'zod';
import { base, Box, Id, Locale, PROTOCOL, Quad, RequestedMode } from './common.ts';

export const Hello = z.object({
  ...base,
  type: z.literal('hello'),
  appVersion: z.string().min(1).max(32),
  protocol: z.literal(PROTOCOL),
  locale: Locale,
  mode: RequestedMode,
  privacy: z.enum(['normal', 'private']),
  caps: z.object({ simRunId: Id.optional(), glasses: z.boolean().optional() }),
  resume: z.object({ sessionId: Id, digest: z.string().max(4096) }).optional(),
});
/** Binary frame header; payload is PCM16LE mono. */
export const Audio = z.object({ ...base, type: z.literal('audio'), seq: z.number().int().nonnegative(), sampleRate: z.literal(16000) });
export const AudioEnd = z.object({ ...base, type: z.literal('audio.end') });
export const Goal = z.object({ ...base, type: z.literal('goal'), text: z.string().min(1).max(500), source: z.enum(['asr_device', 'typed']) });
export const OcrToken = z.object({ text: z.string().min(1).max(200), box: Box });
/** Binary frame header; payload is a JPEG. */
export const Keyframe = z.object({
  ...base,
  type: z.literal('keyframe'),
  kind: z.enum(['full', 'screen']),
  quad: Quad.optional(),
  imageSize: z.object({ w: z.number().int().min(1).max(4096), h: z.number().int().min(1).max(4096) }),
  ocrTokens: z.array(OcrToken).max(400),
  purpose: z.enum(['locate', 'verify', 'explore']),
});
export const Evidence = z.enum(['sim', 'screen_change', 'dwell']);
export const EventKind = z.enum(['targetReached', 'tapDetected', 'screenChanged', 'lost', 'pinModeEntered', 'pinModeExited', 'userCancel']);
export const ClientEvent = z
  .object({ ...base, type: z.literal('event'), kind: EventKind, detail: z.object({ evidence: Evidence }).optional() })
  .superRefine((m, ctx) => {
    if (m.kind === 'tapDetected' && m.detail === undefined) ctx.addIssue({ code: 'custom', message: 'tapDetected requires detail.evidence', path: ['detail'] });
    if (m.kind !== 'tapDetected' && m.detail !== undefined) ctx.addIssue({ code: 'custom', message: `${m.kind} must not carry detail`, path: ['detail'] });
  });
export const Answer = z.object({ ...base, type: z.literal('answer'), re: Id, text: z.string().min(1).max(500) });
export const ConfirmReply = z.object({ ...base, type: z.literal('confirm.reply'), re: Id, accepted: z.boolean(), utterance: z.string().max(500) });
export const Abort = z.object({ ...base, type: z.literal('abort'), reason: z.string().max(200).optional() });

export const ClientMessage = z.discriminatedUnion('type', [Hello, Audio, AudioEnd, Goal, Keyframe, ClientEvent, Answer, ConfirmReply, Abort]);
export type ClientMessage = z.infer<typeof ClientMessage>;
export type Hello = z.infer<typeof Hello>;
export type Keyframe = z.infer<typeof Keyframe>;
export type ClientEvent = z.infer<typeof ClientEvent>;
