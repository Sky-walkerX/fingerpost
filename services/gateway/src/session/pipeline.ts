import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
import { Ask, Layout, Target, type Keyframe, type LayoutElement, type Locale, type ServerMessage } from '@fingerpost/protocol';
import type { ModelPort } from '../models/port.ts';
import type { Usage } from '../quota/cost.ts';
import { SPOKEN_ERRORS } from '../errors/spoken.ts';
import { resolveByText, tokenSetRatio } from '../resolve/match.ts';
import { describePosition, listLabels } from '../resolve/describe.ts';
import { fullFrameCoordinates } from './screen-coordinates.ts';
import { AgentSession, type AgentTurn } from '../agent/loop.ts';
import { inferIntent, type RequestedMode } from '../agent/intent.ts';
import { rulesPlanner, type Planner } from '../agent/planner.ts';

/** Sim element ids are kebab-case versions of their labels ("pay-card" ↔ "Pay by card"). */
export const simMatches = (simElementId: string, el: LayoutElement) => tokenSetRatio(simElementId.replaceAll('-', ' '), el.label) >= 0.8;

import type { StartResult } from './types.ts';
export type TaskGate = () => Promise<StartResult>;
export interface PipelineDeps {
  models: ModelPort;
  send: (m: ServerMessage) => void;
  now?: () => number;
  /** Called after every billed model call (Day 3: spend ledger). */
  onUsage?: (u: Usage) => void | Promise<void>;
  /** Called once per new goal before its first locate (Day 3: daily quota + kill switch). */
  beforeTask?: TaskGate;
  /** The kill switch, checked (cached) before every billed keyframe, not only at task start. */
  cloudEnabled?: () => Promise<boolean>;
  /** Day 4: plans multi-step tasks. Default: the deterministic rules planner (mock/dev). */
  planner?: Planner;
  /** The planner failed and the rules planner took over for that step. No content is passed. */
  onPlannerError?: (plannerId: string) => void;
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
  private mode: RequestedMode = 'auto';
  private agent: AgentSession | null = null;

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

  setMode(m: RequestedMode) {
    this.mode = m;
  }

  /** True while a task question (ask/confirm) waits for the user, so a spoken reply is not a new goal. */
  get awaitingReply(): boolean {
    return !!this.agent?.awaiting;
  }

  onGoal(text: string): void {
    this.task.abort();
    this.task = new AbortController();
    this.goal = text;
    this.taskCharged = false;
    this.target = null;
    this.hasSimTouch = false;
    this.lastTap = { keyframeId: null, simElementId: null };
    // Explore is not built yet (cut for v1 beta): it behaves as a single-target guide.
    const intent = inferIntent(text, this.mode) === 'task' ? 'task' : 'guide';
    this.agent = intent === 'task' ? new AgentSession(text, {
      planner: this.d.planner ?? rulesPlanner(),
      ...(this.d.now ? { now: this.d.now } : {}),
      onUsage: (u) => this.d.onUsage?.({ kind: 'spark', ...u }),
      onPlannerError: (id) => this.d.onPlannerError?.(id),
    }) : null;
    this.d.send({ ...this.base(), type: 'goal.ack', goal: text, intent });
  }

  /** Reply to an ask. False when no task question matches: the caller treats the text as a new goal. */
  onAnswer(re: string, text: string): boolean {
    return this.agent?.onAnswer(re, text) ?? false;
  }

  onConfirmReply(re: string, accepted: boolean): void {
    if (this.agent?.onConfirmReply(re, accepted) === 'declined') this.paymentDeclined();
  }

  /** A final voice transcript. True when it answered an open task question (and must not become a goal). */
  onTranscript(text: string): boolean {
    const r = this.agent?.onTranscript(text) ?? null;
    if (r === 'declined') this.paymentDeclined();
    if (r === 'unclear') this.d.send({ ...this.base(), type: 'say', priority: 'safety', text: 'Please say yes to pay, or no to cancel.' });
    return r !== null;
  }

  /** The device entered PIN mode after a confirmed payment press: the cloud part of the task is done. */
  onPinModeEntered(): void {
    if (this.agent?.pinEntered()) this.d.send({ ...this.base(), type: 'finish', result: 'done', say: 'PIN entry is ready.' });
  }

  private paymentDeclined(): void {
    this.target = null;
    this.d.send({ ...this.base(), type: 'finish', result: 'aborted', say: 'Payment not confirmed.' });
  }

  abort(): void {
    this.task.abort();
    this.task = new AbortController();
    this.goal = null;
    this.agent = null;
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
      .then(async (result) => { await this.d.onUsage?.({ kind: 'spark', ...result.usage }); return result; });
    const screen = h.kind === 'full' ? this.d.models.segmentByText({ bytes: jpeg, width: h.imageSize.w, height: h.imageSize.h }, 'touchscreen display')
      .then(async (result) => { await this.d.onUsage?.({ kind: 'sam_image', images: 1 }); return result.polygon; }).catch(() => null) : Promise.resolve(null);
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
    const turn = (layout: Layout) => this.agentTurn(layout, h, image, coordinates, parsed.layout.elements, signal);
    if (h.purpose === 'verify') {
      const pressed = this.target;
      const result = this.verify(h, before, layout);
      if (this.agent && result === 'ok' && pressed) {
        this.agent.pressed(pressed, layout);
        await turn(layout);
      }
      return;
    }
    this.target = null;
    if (this.agent) {
      await turn(layout);
      return;
    }
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
    await this.sendTarget(resolved.element, h, image, coordinates, parsed.layout.elements, signal);
  }

  /** One agent decision for this screen, sent as fp.v1 messages. */
  private async agentTurn(layout: Layout, h: Keyframe, image: { bytes: Uint8Array; mime: 'image/jpeg' },
    coordinates: ReturnType<typeof fullFrameCoordinates>, parsedElements: readonly LayoutElement[], signal: AbortSignal): Promise<void> {
    const agent = this.agent!;
    const turn = await whileActive<AgentTurn>(agent.decide(layout, signal), signal).catch(() => null);
    if (turn === CANCELLED || signal.aborted || agent !== this.agent) return;
    if (!turn) {
      this.d.send({ ...this.base(), type: 'error', code: 'model_unavailable', ...SPOKEN_ERRORS.model_unavailable });
      return;
    }
    for (const { text, priority } of turn.says) this.d.send({ ...this.base(), type: 'say', text, priority });
    const a = turn.action;
    switch (a.kind) {
      case 'target': await this.sendTarget(a.element, h, image, coordinates, parsedElements, signal); break;
      case 'ask': this.d.send(Ask.parse({ ...this.base(), id: a.id, type: 'ask', question: a.question, options: a.options })); break;
      case 'confirm': this.d.send({ ...this.base(), id: a.id, type: 'confirm', summary: a.summary, ...(a.amount ? { amount: a.amount } : {}) }); break;
      case 'finish': this.target = null; this.d.send({ ...this.base(), type: 'finish', result: a.result, say: a.say }); break;
      case 'expect': this.d.send({ ...this.base(), type: 'expect', description: a.description }); break;
      case 'wait': break;
    }
  }

  /** Refine the element with SAM from its Spark box, then send the target. */
  private async sendTarget(element: LayoutElement, h: Keyframe, image: { bytes: Uint8Array; mime: 'image/jpeg' },
    coordinates: ReturnType<typeof fullFrameCoordinates>, parsedElements: readonly LayoutElement[], signal: AbortSignal): Promise<void> {
    const original = parsedElements.find(({ id }) => id === element.id) ?? element;
    const us = original.polygon.map(({ u }) => u), vs = original.polygon.map(({ v }) => v);
    const mask = await whileActive(this.d.models.segmentByBox({ ...image, width: h.imageSize.w, height: h.imageSize.h }, {
      left: Math.min(...us) * h.imageSize.w, top: Math.min(...vs) * h.imageSize.h,
      right: Math.max(...us) * h.imageSize.w, bottom: Math.max(...vs) * h.imageSize.h,
    }).then(async (result) => { await this.d.onUsage?.({ kind: 'sam_image', images: 1 }); return result; }), signal);
    if (mask === CANCELLED || signal.aborted) return;
    const refined = mask.polygon && (coordinates ? coordinates.toScreen(mask.polygon) : mask.polygon);
    const polygon = refined || element.polygon;
    const target = Target.parse({ ...this.base(), type: 'target', elementId: element.id, polygon,
      confidence: Math.min(element.confidence, refined ? mask.confidence ?? element.confidence : element.confidence),
      say: `Found ${element.label}, ${describePosition(polygon)}.` });
    this.target = element;
    this.d.send(target);
  }

  private verify(h: Keyframe, before: Layout | null, after: Layout): 'ok' | 'wrong' | 'nochange' {
    const touched = this.hasSimTouch, actual = this.lastTap.simElementId;
    this.hasSimTouch = false;
    this.lastTap = { keyframeId: null, simElementId: null };
    if (touched && this.target && (actual === null || !simMatches(actual, this.target))) {
      this.d.send({ ...this.base(), type: 'verify', re: h.id, result: 'wrong',
        ...(actual !== null ? { actualElementId: actual } : {}), say: `That pressed something else. Let's find ${this.target.label} again.` });
      return 'wrong';
    } else if (!before || labelJaccard(before.elements, after.elements) < 0.7 || touched) {
      this.d.send({ ...this.base(), type: 'verify', re: h.id, result: 'ok', say: 'Done.' });
      return 'ok';
    }
    this.d.send({ ...this.base(), type: 'verify', re: h.id, result: 'nochange', say: "The screen didn't change. Press a little firmer." });
    return 'nochange';
  }
}
