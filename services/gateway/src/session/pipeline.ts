import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
import { Ask, Layout, Target, type Keyframe, type LayoutElement, type Locale, type ServerMessage } from '@fingerpost/protocol';
import type { ModelPort } from '../models/port.ts';
import type { Usage } from '../quota/cost.ts';
import { SPOKEN_ERRORS } from '../errors/spoken.ts';
import { resolveByText, tokenSetRatio } from '../resolve/match.ts';
import { describePosition, listLabels } from '../resolve/describe.ts';
import { fullFrameCoordinates } from './screen-coordinates.ts';

/** Sim element ids are kebab-case versions of their labels ("pay-card" ↔ "Pay by card"). */
export const simMatches = (simElementId: string, el: LayoutElement) => tokenSetRatio(simElementId.replaceAll('-', ' '), el.label) >= 0.8;

import type { StartResult } from './types.ts';
export type TaskGate = () => Promise<StartResult>;
export interface PipelineDeps {
  models: ModelPort;
  send: (m: ServerMessage) => void;
  now?: () => number;
  /** Called after every billed model call (Day 3: spend ledger). */
  onUsage?: (u: Usage) => void;
  /** Called once per new goal before its first locate (Day 3: daily quota + kill switch). */
  beforeTask?: TaskGate;
  /** The kill switch, checked (cached) before every billed keyframe, not only at task start. */
  cloudEnabled?: () => Promise<boolean>;
}

/** Billed keyframes allowed per charged task (the agent's 20-step budget, design §4.3). */
export const MAX_CALLS_PER_TASK = 20;

const CANCELLED = Symbol('cancelled');

/** Release the session queue even if a model ignores cancellation; still consume its eventual result. */
function whileActive<T>(work: Promise<T>, signal: AbortSignal): Promise<T | typeof CANCELLED> {
  return new Promise((resolve, reject) => {
    const cancel = () => resolve(CANCELLED);
    if (signal.aborted) cancel();
    else signal.addEventListener('abort', cancel, { once: true });
    work.then((value) => {
      signal.removeEventListener('abort', cancel);
      resolve(signal.aborted ? CANCELLED : value);
    }, (error: unknown) => {
      signal.removeEventListener('abort', cancel);
      if (signal.aborted) resolve(CANCELLED);
      else reject(error);
    });
  });
}

/** sha256 of the sorted normalized labels, as "sh64:<16 hex>". Day 5 replaces this with SimHash (kiosk memory). */
export function layoutFingerprint(elements: readonly LayoutElement[]): string {
  const labels = elements.map((element) => element.textNorm ?? element.label.toLowerCase()).sort();
  return `sh64:${createHash('sha256').update(labels.join('|')).digest('hex').slice(0, 16)}`;
}

/** Jaccard similarity of two layouts' normalized label sets. */
export function labelJaccard(a: readonly LayoutElement[], b: readonly LayoutElement[]): number {
  const keys = (elements: readonly LayoutElement[]) => new Set(elements.map((element) => element.textNorm ?? element.label.toLowerCase()));
  const left = keys(a), right = keys(b);
  const union = new Set([...left, ...right]);
  return union.size ? [...left].filter((key) => right.has(key)).length / union.size : 1;
}

/**
 * Day 2 session brain: goal → keyframe(locate) → layout + target | ask; keyframe(verify) → verify.
 * The agent loop (Day 4) replaces the single-target logic but keeps these message shapes.
 */
export class SessionPipeline {
  private goal: string | null = null;
  private locale: Locale = 'en';
  private layout: Layout | null = null;
  private target: LayoutElement | null = null;
  private lastTap: { keyframeId: string | null; simElementId: string | null } = { keyframeId: null, simElementId: null };
  private taskCharged = false;
  private everCharged = false;
  private callsSinceCharge = 0;
  private hasSimTouch = false;
  private task = new AbortController();

  private readonly d: PipelineDeps;
  constructor(d: PipelineDeps) { this.d = d; }
  private now() {
    return this.d.now?.() ?? Date.now();
  }
  private base() {
    return { id: ulid(), ts: this.now() };
  }

  setLocale(l: Locale) {
    this.locale = l;
  }

  onGoal(text: string): void {
    this.task.abort();
    this.task = new AbortController();
    this.goal = text;
    this.taskCharged = false;
    this.target = null;
    this.hasSimTouch = false;
    this.lastTap = { keyframeId: null, simElementId: null };
    this.d.send({ ...this.base(), type: 'goal.ack', goal: text, intent: 'guide' });
  }

  abort(): void {
    this.task.abort();
    this.task = new AbortController();
    this.goal = null;
    this.layout = null;
    this.target = null;
    this.taskCharged = false;
    this.everCharged = false;
    this.callsSinceCharge = 0;
    this.hasSimTouch = false;
    this.lastTap = { keyframeId: null, simElementId: null };
  }

  /** The sim reported a touch for this session's run. Remembered as press evidence for the next verify. */
  onSimTouch(elementId: string | null): void {
    this.hasSimTouch = true;
    this.lastTap = { keyframeId: this.layout?.id ?? null, simElementId: elementId };
  }

  private refuse(code: 'cloud_paused' | 'quota_exhausted' | 'rate_limited') {
    this.d.send({ ...this.base(), type: 'error', code, ...SPOKEN_ERRORS[code] });
  }

  async onKeyframe(h: Keyframe, jpeg: Uint8Array): Promise<void> {
    const signal = this.task.signal;
    // Nothing to look for yet: don't spend a model call.
    if (h.purpose === 'locate' && !this.goal) return;
    if (h.purpose === 'locate' && !this.taskCharged) {
      const allowed = await whileActive(Promise.resolve(this.d.beforeTask?.()), signal);
      if (allowed === CANCELLED || signal.aborted) return;
      if (allowed && !allowed.ok) {
        this.refuse(allowed.code);
        return;
      }
      this.taskCharged = true;
      this.everCharged = true;
      this.callsSinceCharge = 0;
    }
    // Verify keyframes ride on a charged task, with a per-task cap, so they can't be used to parse for free.
    if (!this.everCharged) return;
    if (++this.callsSinceCharge > MAX_CALLS_PER_TASK) {
      this.refuse('rate_limited');
      return;
    }
    if (this.d.cloudEnabled) {
      const enabled = await whileActive(this.d.cloudEnabled(), signal);
      if (enabled === CANCELLED || signal.aborted) return;
      if (!enabled) {
        this.refuse('cloud_paused');
        return;
      }
    }
    const before = this.layout;
    const image = { bytes: jpeg, mime: 'image/jpeg' as const };
    const parse = this.d.models.parseScreen(image, { locale: this.locale, ...(this.goal ? { goal: this.goal } : {}) })
      .then((result) => { this.d.onUsage?.({ kind: 'spark', ...result.usage }); return result; });
    const screen = h.kind === 'full' ? this.d.models.segmentByText({ bytes: jpeg, width: h.imageSize.w, height: h.imageSize.h }, 'touchscreen display')
      .then((result) => { this.d.onUsage?.({ kind: 'sam_image', images: 1 }); return result.polygon; }).catch(() => null) : Promise.resolve(null);
    const result = await whileActive(Promise.all([parse, screen]), signal);
    if (result === CANCELLED || signal.aborted) return;
    const [parsed, screenMask] = result;
    const coordinates = h.kind === 'full' ? fullFrameCoordinates(h.imageSize, screenMask, h.quad, parsed.layout.rotation) : null;
    if (h.kind === 'full' && !coordinates) {
      this.d.send({ ...this.base(), type: 'ask', question: "I can't find the screen. Hold the phone steady and try again.", options: [] });
      return;
    }
    const elements = coordinates ? parsed.layout.elements.flatMap((element) => {
      const polygon = coordinates.toScreen(element.polygon);
      return polygon ? [{ ...element, polygon }] : [];
    }) : parsed.layout.elements;
    const layout = Layout.parse({ ...this.base(), type: 'layout', ...parsed.layout, elements,
      ...(coordinates ? { screenQuad: coordinates.screenQuad } : {}),
      fingerprint: layoutFingerprint(elements), source: 'model' });
    this.layout = layout;
    this.d.send(layout);
    if (signal.aborted) return;
    if (h.purpose === 'verify') {
      this.verify(h, before, layout);
      return;
    }
    this.target = null;
    const resolved = resolveByText(this.goal ?? '', layout.elements);
    if (resolved.kind !== 'match') {
      const elements = resolved.kind === 'ambiguous' ? resolved.candidates : layout.elements.filter((element) => element.role !== 'text');
      const labels = listLabels(elements) || 'nothing I can read';
      const prefix = resolved.kind === 'ambiguous' ? 'I see ' : "I can't find that. I see ";
      const suffix = resolved.kind === 'ambiguous' ? '. Which one?' : '. What do you want to press?';
      const budget = Ask.shape.question.maxLength! - prefix.length - suffix.length;
      this.d.send(Ask.parse({ ...this.base(), type: 'ask', question: prefix + labels.slice(0, budget) + suffix,
        options: elements.slice(0, 8).map(({ label }) => label.slice(0, 100)) }));
      return;
    }
    const element = resolved.element;
    const original = parsed.layout.elements.find(({ id }) => id === element.id)!;
    const us = original.polygon.map(({ u }) => u), vs = original.polygon.map(({ v }) => v);
    const mask = await whileActive(this.d.models.segmentByBox({ ...image, width: h.imageSize.w, height: h.imageSize.h }, {
      left: Math.min(...us) * h.imageSize.w, top: Math.min(...vs) * h.imageSize.h,
      right: Math.max(...us) * h.imageSize.w, bottom: Math.max(...vs) * h.imageSize.h,
    }).then((result) => { this.d.onUsage?.({ kind: 'sam_image', images: 1 }); return result; }), signal);
    if (mask === CANCELLED || signal.aborted) return;
    const refined = mask.polygon && (coordinates ? coordinates.toScreen(mask.polygon) : mask.polygon);
    const polygon = refined || element.polygon;
    const target = Target.parse({ ...this.base(), type: 'target', elementId: element.id, polygon,
      confidence: Math.min(element.confidence, refined ? mask.confidence ?? element.confidence : element.confidence),
      say: `Found ${element.label}, ${describePosition(polygon)}.` });
    this.target = element;
    this.d.send(target);
  }

  private verify(h: Keyframe, before: Layout | null, after: Layout): void {
    const touched = this.hasSimTouch, actual = this.lastTap.simElementId;
    this.hasSimTouch = false;
    this.lastTap = { keyframeId: null, simElementId: null };
    if (touched && this.target && (actual === null || !simMatches(actual, this.target))) {
      this.d.send({ ...this.base(), type: 'verify', re: h.id, result: 'wrong',
        ...(actual !== null ? { actualElementId: actual } : {}), say: `That pressed something else. Let's find ${this.target.label} again.` });
    } else if (!before || labelJaccard(before.elements, after.elements) < 0.7 || touched) {
      this.d.send({ ...this.base(), type: 'verify', re: h.id, result: 'ok', say: 'Done.' });
    } else {
      this.d.send({ ...this.base(), type: 'verify', re: h.id, result: 'nochange', say: "The screen didn't change. Press a little firmer." });
    }
  }
}
