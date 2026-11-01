import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { z } from 'zod';
import { LIMITS, Locale } from '@fingerpost/protocol';
import { verifySessionToken } from '../auth/tokens.ts';
import { clientKey, FixedWindowLimiter, overflowKey } from '../auth/rate-limit.ts';

/**
 * Opt-in "donate this session" (ADR 0005, design §4.7, Days 4–7 plan C5-4). The phone asks after a failed
 * task; with a yes it blurs faces and masks 13–19-digit numbers, then uploads straight to a restricted bucket
 * through short-lived signed URLs. The gateway never sees the bytes and stores no uid, IP or content: only a
 * pointer record that expires with the objects after 90 days.
 */
export const DONATE_CONSENT_VERSION = 'donate.v1';
export const DONATION_RETENTION_MS = 90 * 24 * 60 * 60_000;
export const UPLOAD_URL_TTL_MS = 15 * 60_000;
export const MAX_KEYFRAMES = 20;
/** Landmark/quad replay JSON (no images, no OCR text). */
export const MAX_REPLAY_BYTES = 256 * 1024;

const File = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('keyframe'), contentType: z.literal('image/jpeg'), bytes: z.number().int().min(1).max(LIMITS.keyframeBytes) }),
  z.strictObject({ kind: z.literal('replay'), contentType: z.literal('application/json'), bytes: z.number().int().min(1).max(MAX_REPLAY_BYTES) }),
]);
const DonateBody = z.strictObject({
  consent: z.strictObject({ version: z.literal(DONATE_CONSENT_VERSION), accepted: z.literal(true) }),
  /** The device states it ran both redactions; the server cannot see the images to check. */
  redacted: z.strictObject({ faces: z.literal(true), cardNumbers: z.literal(true) }),
  locale: Locale,
  /** How the task ended: failed (gave up), wrong (pressed the wrong control) or nochange (press not seen). */
  outcome: z.enum(['failed', 'wrong', 'nochange']),
  files: z.array(File).min(1).max(MAX_KEYFRAMES + 1),
}).refine((b) => b.files.filter((f) => f.kind === 'replay').length <= 1 && b.files.filter((f) => f.kind === 'keyframe').length <= MAX_KEYFRAMES);

export interface DonationObject { name: string; kind: 'keyframe' | 'replay'; contentType: string; bytes: number; }
/** donations/{id}: pointers only (design §4.9). */
export interface DonationRecord {
  id: string; createdAt: number; deleteAfter: number; consentVersion: string;
  locale: z.infer<typeof Locale>; outcome: 'failed' | 'wrong' | 'nochange'; objects: DonationObject[];
}
export interface SignedUpload { url: string; headers: Record<string, string>; }

export interface DonationStore {
  /** A PUT URL for exactly this object, content type and size limit, valid until expiresAtMs. */
  signUpload(objectName: string, contentType: string, maxBytes: number, expiresAtMs: number): Promise<SignedUpload>;
  record(d: DonationRecord): Promise<void>;
}

export const uploadHeaders = (contentType: string, maxBytes: number) =>
  ({ 'content-type': contentType, 'x-goog-content-length-range': `1,${maxBytes}` });

/** Mock/dev and tests: nothing leaves the process; URLs point at a reserved, unreachable host. */
export class MemoryDonationStore implements DonationStore {
  readonly signed: { objectName: string; contentType: string; maxBytes: number; expiresAtMs: number }[] = [];
  readonly records: DonationRecord[] = [];
  async signUpload(objectName: string, contentType: string, maxBytes: number, expiresAtMs: number): Promise<SignedUpload> {
    this.signed.push({ objectName, contentType, maxBytes, expiresAtMs });
    return { url: `https://donations.invalid/${objectName}`, headers: uploadHeaders(contentType, maxBytes) };
  }
  async record(d: DonationRecord): Promise<void> { this.records.push(d); }
}

export interface DonateDeps {
  /** null: no bucket configured (live without DONATE_BUCKET) → 503. */
  store: DonationStore | null;
  /** Session JWT secret when AUTH_REQUIRED; null lets unauthenticated mock/dev clients donate. */
  authSecret: Uint8Array | null;
  cloudEnabled: () => Promise<boolean>;
  now?: () => number;
  /** Per hour. Defaults: 3 per user (or per IP without auth), 10 per IP. */
  limits?: { perUserPerHour?: number; perIpPerHour?: number };
}

const unavailable = { error: 'donations_unavailable' } as const;

export function registerDonateRoute(app: FastifyInstance, d: DonateDeps): void {
  const now = d.now ?? Date.now;
  const hour = 60 * 60_000;
  const userLimit = new FixedWindowLimiter(d.limits?.perUserPerHour ?? 3, hour, now);
  const ipLimit = new FixedWindowLimiter(d.limits?.perIpPerHour ?? 10, hour, now);

  app.post('/v1/donate', async (req, reply) => {
    let who = `ip:${clientKey(req.ip)}`;
    if (d.authSecret) {
      const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
      const claims = token ? await verifySessionToken(d.authSecret, token, now()) : null;
      if (!claims) return reply.code(401).send({ error: 'auth required' });
      who = `uid:${claims.uid}`;
    }
    const parsed = DonateBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    if (!ipLimit.hit(clientKey(req.ip), overflowKey(req.ip)) || !userLimit.hit(who)) return reply.code(429).send({ error: 'rate limited' });
    if (!d.store || !(await d.cloudEnabled())) return reply.code(503).send(unavailable);

    const t = now(), id = ulid(t), day = new Date(t).toISOString().slice(0, 10);
    const objects: DonationObject[] = parsed.data.files.map((f, i) => ({
      name: `${day}/${id}/${i}-${f.kind}.${f.kind === 'keyframe' ? 'jpg' : 'json'}`, kind: f.kind, contentType: f.contentType, bytes: f.bytes }));
    const record: DonationRecord = { id, createdAt: t, deleteAfter: t + DONATION_RETENTION_MS, consentVersion: DONATE_CONSENT_VERSION,
      locale: parsed.data.locale, outcome: parsed.data.outcome, objects };
    const expiresAt = t + UPLOAD_URL_TTL_MS;
    try {
      // Pointer first: an object can never exist in the bucket without a record that expires it.
      await d.store.record(record);
      const uploads = await Promise.all(objects.map(async (o, index) => {
        const signed = await d.store!.signUpload(o.name, o.contentType, o.bytes, expiresAt);
        return { index, kind: o.kind, method: 'PUT' as const, url: signed.url, headers: signed.headers };
      }));
      return { donationId: id, uploads, uploadExpiresAt: expiresAt, deleteAfter: record.deleteAfter };
    } catch {
      req.log.warn({ donation: 'failed' }, 'donation setup failed');
      return reply.code(503).send(unavailable);
    }
  });
}
