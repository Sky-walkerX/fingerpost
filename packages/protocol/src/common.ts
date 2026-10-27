import { z } from 'zod';

export const PROTOCOL = 'fp.v1' as const;
export const LIMITS = { textBytes: 16_384, headerBytes: 16_384, keyframeBytes: 409_600 } as const;

export const Id = z.string().min(1).max(64);
export const Ts = z.number().int().nonnegative();
export const Locale = z.enum(['en', 'hi', 'es']);
export const Priority = z.enum(['safety', 'state', 'guide', 'info']);
export const Unit = z.number().min(0).max(1);

/** Image pixels of the analysis frame. */
export const Point = z.object({ x: z.number(), y: z.number() });
/** Screen-normalized coordinates, 0..1. */
export const UV = z.object({ u: Unit, v: Unit });
export const Box = z.object({ u: Unit, v: Unit, w: Unit, h: Unit });
export const Quad = z.array(Point).length(4);
export const Polygon = z.array(UV).min(3).max(32);

export const ElementRole = z.enum(['button', 'pay', 'confirm', 'submit', 'back', 'cancel', 'input', 'text', 'icon', 'key']);
export const ScreenType = z.enum(['menu', 'form', 'confirm', 'payment_entry', 'pin_pad', 'appliance', 'info', 'unknown']);
export const Sensitivity = z.enum(['none', 'financial', 'identity']);
export const RequestedMode = z.enum(['auto', 'guide', 'task', 'explore']);
export const Intent = z.enum(['guide', 'task', 'explore']);
export const SessionMode = z.enum(['normal', 'pin', 'private', 'offline']);
export const ErrorCode = z.enum(['auth_expired', 'quota_exhausted', 'cloud_paused', 'rate_limited', 'model_unavailable', 'bad_message', 'version_unsupported']);

export const base = { id: Id, ts: Ts };

export type Locale = z.infer<typeof Locale>;
export type Priority = z.infer<typeof Priority>;
export type Point = z.infer<typeof Point>;
export type UV = z.infer<typeof UV>;
export type Box = z.infer<typeof Box>;
export type Polygon = z.infer<typeof Polygon>;
export type ElementRole = z.infer<typeof ElementRole>;
export type ScreenType = z.infer<typeof ScreenType>;
export type Sensitivity = z.infer<typeof Sensitivity>;
export type ErrorCode = z.infer<typeof ErrorCode>;
