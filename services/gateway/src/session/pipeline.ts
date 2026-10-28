import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
import { Ask, Layout, Target, type Keyframe, type LayoutElement, type Locale, type ServerMessage } from '@fingerpost/protocol';
import type { ModelPort } from '../models/port.ts';
import type { Usage } from '../quota/cost.ts';
import { SPOKEN_ERRORS } from '../errors/spoken.ts';
import { resolveByText, tokenSetRatio } from '../resolve/match.ts';
import { describePosition, listLabels } from '../resolve/describe.ts';

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
  private hasSimTouch = false;

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
    this.goal = text;
    this.taskCharged = false;
    this.target = null;
    this.hasSimTouch = false;
    this.lastTap = { keyframeId: null, simElementId: null };
    this.d.send({ ...this.base(), type: 'goal.ack', goal: text, intent: 'guide' });
  }

  /** The sim reported a touch for this session's run. Remembered as press evidence for the next verify. */
  onSimTouch(elementId: string | null): void {
    this.hasSimTouch = true;
    this.lastTap = { keyframeId: this.layout?.id ?? null, simElementId: elementId };
  }

  async onKeyframe(h: Keyframe, jpeg: Uint8Array): Promise<void> {
    if (h.purpose === 'locate' && this.goal && !this.taskCharged) {
      const allowed = await this.d.beforeTask?.();
      if (allowed && !allowed.ok) {
        this.d.send({ ...this.base(), type: 'error', code: allowed.code, ...SPOKEN_ERRORS[allowed.code] });
        return;
      }
      this.taskCharged = true;
    }
    const before = this.layout;
    const image = { bytes: jpeg, mime: 'image/jpeg' as const };
    const parsed = await this.d.models.parseScreen(image, { locale: this.locale, ...(this.goal ? { goal: this.goal } : {}) });
    this.d.onUsage?.({ kind: 'spark', ...parsed.usage });
    const layout = Layout.parse({ ...this.base(), type: 'layout', ...parsed.layout,
      fingerprint: layoutFingerprint(parsed.layout.elements), source: 'model' });
    this.layout = layout;
    this.d.send(layout);
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
    const us = element.polygon.map(({ u }) => u), vs = element.polygon.map(({ v }) => v);
    const mask = await this.d.models.segmentByBox({ ...image, width: h.imageSize.w, height: h.imageSize.h }, {
      left: Math.min(...us) * h.imageSize.w, top: Math.min(...vs) * h.imageSize.h,
      right: Math.max(...us) * h.imageSize.w, bottom: Math.max(...vs) * h.imageSize.h,
    });
    this.d.onUsage?.({ kind: 'sam_image', images: 1 });
    const polygon = mask.polygon ?? element.polygon;
    const target = Target.parse({ ...this.base(), type: 'target', elementId: element.id, polygon,
      confidence: Math.min(element.confidence, mask.polygon ? mask.confidence ?? element.confidence : element.confidence),
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
