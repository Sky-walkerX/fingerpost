import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
import { Ask, Layout, Target, type Keyframe, type LayoutElement, type Locale, type ServerMessage } from '@fingerpost/protocol';
import type { ModelPort } from '../models/port.ts';
import { ModelsUnavailable, PrivateUnavailable, type RoutedModels } from '../models/router.ts';
import type { Usage } from '../quota/cost.ts';
import { spokenError, t } from '../i18n/strings.ts';
import { resolveByText, tokenSetRatio } from '../resolve/match.ts';
import { describePosition, listLabels } from '../resolve/describe.ts';
import { fullFrameCoordinates } from './screen-coordinates.ts';
import { AgentSession, type AgentTurn } from '../agent/loop.ts';
import { inferIntent, type RequestedMode } from '../agent/intent.ts';
import { rulesPlanner, type Planner } from '../agent/planner.ts';
import { firstSay, isMore, nextSay, summarize } from '../explore/summary.ts';
import type { MemoryService } from '../memory/service.ts';

/** Sim element ids are kebab-case versions of their labels ("pay-card" ↔ "Pay by card"). */
export const simMatches = (simElementId: string, el: LayoutElement) => tokenSetRatio(simElementId.replaceAll('-', ' '), el.label) >= 0.8;

import type { StartResult } from './types.ts';
export type TaskGate = () => Promise<StartResult>;
export type TaskOutcome = 'success' | 'error' | 'cancelled';
export interface PipelineDeps {
  onTask?: () => (outcome: TaskOutcome) => void;
  models: ModelPort;
  send: (m: ServerMessage) => void;
  now?: () => number;
  /** Called after every billed model call (Day 3: spend ledger). */
  onUsage?: (u: Usage) => void | Promise<void>;
  /** Called once per new goal before its first locate (Day 3: daily quota + kill switch). */
  beforeTask?: TaskGate;
  /** The kill switch, checked (cached) before every billed keyframe, not only at task start. */
  cloudEnabled?: () => Promise<boolean>;
  /** B5-2: kiosk memory. Known screens are answered without a model call. */
  memory?: MemoryService;
  /** The attested key id that vouches for what this session records (dev: 'dev-key'). */
  keyId?: string;
  /** B4-1: picks Meta or Glimmer per frame from the session's privacy and the last screen's sensitivity. */
  route?: RoutedModels;
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
  /** The session's language for spoken text (B4-4). */
  get speechLocale(): Locale { return this.locale; }
  /** Protected speech/history stays on-device for the remainder of this socket. */
  get requiresLocalSpeech(): boolean { return this.privacy === 'private' || this.sensitive || this.privatePlanning; }
  private layout: Layout | null = null;
  private target: LayoutElement | null = null;
  private lastTap: { keyframeId: string | null; simElementId: string | null } = { keyframeId: null, simElementId: null };
  private taskCharged = false;
  private endTask: ((outcome: TaskOutcome) => void) | undefined;
  private everCharged = false;
  private callsSinceCharge = 0;
  private hasSimTouch = false;
  private task = new AbortController();
  private mode: RequestedMode = 'auto';
  private privacy: 'normal' | 'private' = 'normal';
  /** Only a freshly parsed safe layout clears routing protection; goals/abort cannot. */
  private sensitive = false;
  private privatePlanning = false;
  /** The port that read the current frame; SAM refinement of its target uses the same provider. */
  private frameModels: ModelPort | null = null;
  /** The current frame's layout came from kiosk memory: its polygons are final, no SAM refinement. */
  private frameFromMemory = false;
  private agent: AgentSession | null = null;
  private lookingSpoken = false;
  /** Explore (B5-1): the regions of the last summarized screen and how many were read. null outside explore. */
  private explore: { regions: string[] | null; cursor: number } | null = null;

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

  setPrivacy(p: 'normal' | 'private') {
    this.privacy = p;
  }

  /** The models for the next frame, or null after telling the user private mode is unavailable. */
  private models(): ModelPort | null {
    if (!this.d.route && this.privacy === 'normal' && !this.sensitive) return this.d.models;
    try {
      if (!this.d.route) throw new PrivateUnavailable();
      return this.d.route.forSession(this.privacy, this.sensitive ? 'financial' : 'none');
    } catch (error) {
      if (!(error instanceof PrivateUnavailable)) throw error;
      this.d.send({ ...this.base(), type: 'mode', mode: 'private', reason: 'Private models are not available.' });
      this.d.send({ ...this.base(), type: 'error', code: 'model_unavailable', retryable: false, say: t(this.locale, 'private_unavailable') });
      return null;
    }
  }

  /** True while a task question (ask/confirm) waits for the user, so a spoken reply is not a new goal. */
  get awaitingReply(): boolean {
    return !!this.agent?.awaiting;
  }

  onGoal(text: string): void {
    // "more" while exploring reads the next region; it is not a new goal.
    if (this.explore?.regions && isMore(text)) {
      const next = nextSay(this.explore.regions, this.explore.cursor, this.locale);
      this.explore.cursor = next.cursor;
      this.d.send({ ...this.base(), type: 'say', priority: 'info', text: next.text.slice(0, 500) });
      return;
    }
    this.completeTask('cancelled');
    this.task.abort();
    this.task = new AbortController();
    this.goal = text;
    this.lookingSpoken = false;
    this.taskCharged = false;
    this.target = null;
    this.hasSimTouch = false;
    this.lastTap = { keyframeId: null, simElementId: null };
    const intent = inferIntent(text, this.mode);
    this.explore = intent === 'explore' ? { regions: null, cursor: 0 } : null;
    this.agent = intent === 'task' ? new AgentSession(text, {
      planner: { id: 'privacy-guarded', next: (state, signal) => {
        // Once a task sees protected data, its history/answers must stay off Spark too.
        this.privatePlanning ||= this.privacy === 'private' || this.sensitive;
        return (this.privatePlanning ? rulesPlanner() : this.d.planner ?? rulesPlanner()).next(state, signal);
      } },
      ...(this.d.now ? { now: this.d.now } : {}),
      onUsage: (u) => this.d.onUsage?.({ kind: 'spark', ...u }),
      onPlannerError: (id) => this.d.onPlannerError?.(id),
      locale: this.locale,
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
    return r !== null;
  }

  /** The device entered PIN mode after a confirmed payment press: the cloud part of the task is done. */
  onPinModeEntered(): void {
    if (this.agent?.pinEntered()) {
      this.completeTask('success');
      this.d.send({ ...this.base(), type: 'finish', result: 'done', say: t(this.locale, 'pin_ready') });
    }
  }

  private paymentDeclined(): void {
    this.completeTask('cancelled');
    this.target = null;
    this.d.send({ ...this.base(), type: 'finish', result: 'aborted', say: t(this.locale, 'payment_not_confirmed') });
  }

  abort(): void {
    this.completeTask('cancelled');
    this.task.abort();
    this.task = new AbortController();
    this.goal = null;
    this.agent = null;
    this.layout = null;
    this.target = null;
    this.lookingSpoken = false;
    this.explore = null;
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

  private completeTask(outcome: TaskOutcome, signal = this.task.signal): void {
    if (signal !== this.task.signal) return;
    const terminal = this.endTask;
    this.endTask = undefined;
    terminal?.(outcome);
  }

  failTask(): void { this.completeTask('error'); }

  private refuse(code: 'cloud_paused' | 'quota_exhausted' | 'rate_limited') {
    this.completeTask('error');
    this.d.send({ ...this.base(), type: 'error', code, ...spokenError(code, this.locale) });
  }

  async onKeyframe(h: Keyframe, jpeg: Uint8Array): Promise<void> {
    const signal = this.task.signal;
    try { await this.processKeyframe(h, jpeg); }
    catch (error) {
      if (!signal.aborted) this.completeTask('error', signal);
      throw error;
    }
  }

  private async processKeyframe(h: Keyframe, jpeg: Uint8Array): Promise<void> {
    const signal = this.task.signal;
    // Nothing to look for yet: don't spend a model call.
    // An explore frame is read like a locate frame: it needs a goal and starts the charged task.
    const reading = h.purpose === 'locate' || h.purpose === 'explore';
    if (reading && !this.goal) return;
    // Route before charging: a private session without Glimmer is refused and costs nothing.
    const models = this.models();
    if (!models) return;
    this.frameModels = models;
    if (reading && !this.taskCharged) {
      const allowed = await whileActive(Promise.resolve(this.d.beforeTask?.()), signal);
      if (allowed === CANCELLED || signal.aborted) return;
      if (allowed && !allowed.ok) {
        this.refuse(allowed.code);
        return;
      }
      this.endTask = this.d.onTask?.();
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
    const remembered = await whileActive(this.fromMemory(h), signal).catch(() => null);
    if (remembered === CANCELLED || signal.aborted) return;
    this.frameFromMemory = !!remembered;
    let layout: Layout;
    let coordinates: ReturnType<typeof fullFrameCoordinates> = null;
    let parsedElements: readonly LayoutElement[];
    if (remembered) {
      layout = Layout.parse({ ...remembered, ...this.base() });
      parsedElements = layout.elements;
    } else {
    if (h.purpose === 'locate' && !this.lookingSpoken) {
      this.lookingSpoken = true;
      this.d.send({ ...this.base(), type: 'say', priority: 'state', text: t(this.locale, 'looking') });
    }
    const parse = models.parseScreen(image, { locale: this.locale, ...(this.goal ? { goal: this.goal } : {}) })
      .then(async (result) => { await this.d.onUsage?.({ kind: 'spark', ...result.usage }); return result; });
    const screen = h.kind === 'full' ? models.segmentByText({ bytes: jpeg, width: h.imageSize.w, height: h.imageSize.h }, 'touchscreen display')
      .then(async (result) => { await this.d.onUsage?.({ kind: 'sam_image', images: 1 }); return result.polygon; }).catch(() => null) : Promise.resolve(null);
    let result: Awaited<ReturnType<typeof whileActive<[Awaited<typeof parse>, Awaited<typeof screen>]>>>;
    try {
      result = await whileActive(Promise.all([parse, screen]), signal);
    } catch (error) {
      if (!(error instanceof ModelsUnavailable)) throw error;
      // The whole chain failed (Spark 1.3, 1.2, retry, Glimmer): switch the session to offline basic mode.
      this.completeTask('error', signal);
      this.d.send({ ...this.base(), type: 'mode', mode: 'offline', reason: t(this.locale, 'offline') });
      return;
    }
    if (result === CANCELLED || signal.aborted) return;
    const [parsed, screenMask] = result;
    const mapped = h.kind === 'full' ? fullFrameCoordinates(h.imageSize, screenMask, h.quad, parsed.layout.rotation) : null;
    coordinates = mapped;
    if (h.kind === 'full' && !mapped) {
      this.d.send({ ...this.base(), type: 'ask', question: t(this.locale, 'no_screen'), options: [] });
      return;
    }
    const elements = mapped ? parsed.layout.elements.flatMap((element) => {
      const polygon = mapped.toScreen(element.polygon);
      return polygon ? [{ ...element, polygon }] : [];
    }) : parsed.layout.elements;
    layout = Layout.parse({ ...this.base(), type: 'layout', ...parsed.layout, elements,
      ...(mapped ? { screenQuad: mapped.screenQuad } : {}),
      fingerprint: layoutFingerprint(elements), source: 'model' });
    parsedElements = parsed.layout.elements;
    this.remember(h, layout);
    }
    this.layout = layout;
    this.sensitive = layout.sensitivity !== 'none';
    this.privatePlanning ||= this.privacy === 'private' || this.sensitive;
    this.d.send(layout);
    // Classification now protects refinement and planning as well as the next frame.
    if (this.sensitive) {
      const protectedModels = this.models();
      if (!protectedModels) { this.completeTask('error', signal); return; }
      this.frameModels = protectedModels;
    }
    if (signal.aborted) return;
    const turn = (layout: Layout) => this.agentTurn(layout, h, image, coordinates, parsedElements, signal);
    if (h.purpose === 'verify') {
      const pressed = this.target;
      const result = this.verify(h, before, layout);
      if (!this.agent && result === 'ok') this.completeTask('success', signal);
      if (this.agent && result === 'ok' && pressed) {
        this.agent.pressed(pressed, layout);
        await turn(layout);
      }
      return;
    }
    this.target = null;
    if (this.explore) {
      this.completeTask('success', signal);
      // Explore never guesses a target: it reads the screen by region (design §3.2).
      const { regions } = summarize(layout, this.locale);
      this.explore = { regions, cursor: Math.min(3, regions.length) };
      this.d.send({ ...this.base(), type: 'say', priority: 'info', text: regions.length ? firstSay(regions, this.locale).slice(0, 500)
        : t(this.locale, 'explore_empty') });
      return;
    }
    if (this.agent) {
      await turn(layout);
      return;
    }
    const resolved = resolveByText(this.goal ?? '', layout.elements);
    if (resolved.kind !== 'match') {
      const elements = resolved.kind === 'ambiguous' ? resolved.candidates : layout.elements.filter((element) => element.role !== 'text');
      const labels = listLabels(elements, 5, this.locale) || t(this.locale, 'nothing_to_read');
      const [prefix, suffix] = t(this.locale, resolved.kind === 'ambiguous' ? 'ask_which' : 'ask_not_found').split('{labels}') as [string, string];
      const budget = Ask.shape.question.maxLength! - prefix.length - suffix.length;
      this.d.send(Ask.parse({ ...this.base(), type: 'ask', question: prefix + labels.slice(0, budget) + suffix,
        options: elements.slice(0, 8).map(({ label }) => label.slice(0, 100)) }));
      return;
    }
    await this.sendTarget(resolved.element, h, image, coordinates, parsedElements, signal);
  }

  /** Kiosk memory applies to rectified screen crops with on-device OCR, never to private sessions. */
  private memoryUsable(h: Keyframe): boolean {
    return !!this.d.memory && h.kind === 'screen' && h.ocrTokens.length > 0 && this.privacy !== 'private' && !this.sensitive;
  }

  private async fromMemory(h: Keyframe): Promise<Layout | null> {
    if (!this.memoryUsable(h)) return null;
    return this.d.memory!.lookup(h.ocrTokens, h.imageSize.w / h.imageSize.h);
  }

  /** Vouch for a freshly parsed screen. Never blocks the user; a store failure is ignored. */
  private remember(h: Keyframe, layout: Layout): void {
    if (!this.memoryUsable(h)) return;
    void this.d.memory!.record(layout, h.ocrTokens, h.imageSize.w / h.imageSize.h, this.d.keyId ?? 'dev-key').catch(() => {});
  }

  /** One agent decision for this screen, sent as fp.v1 messages. */
  private async agentTurn(layout: Layout, h: Keyframe, image: { bytes: Uint8Array; mime: 'image/jpeg' },
    coordinates: ReturnType<typeof fullFrameCoordinates>, parsedElements: readonly LayoutElement[], signal: AbortSignal): Promise<void> {
    const agent = this.agent!;
    const turn = await whileActive<AgentTurn>(agent.decide(layout, signal), signal).catch(() => null);
    if (turn === CANCELLED || signal.aborted || agent !== this.agent) return;
    if (!turn) {
      this.completeTask('error', signal);
      this.d.send({ ...this.base(), type: 'error', code: 'model_unavailable', ...spokenError('model_unavailable', this.locale) });
      return;
    }
    for (const { text, priority } of turn.says) this.d.send({ ...this.base(), type: 'say', text, priority });
    const a = turn.action;
    switch (a.kind) {
      case 'target': await this.sendTarget(a.element, h, image, coordinates, parsedElements, signal); break;
      case 'ask': this.d.send(Ask.parse({ ...this.base(), id: a.id, type: 'ask', question: a.question, options: a.options })); break;
      case 'confirm': this.d.send({ ...this.base(), id: a.id, type: 'confirm', summary: a.summary, ...(a.amount ? { amount: a.amount } : {}) }); break;
      case 'finish': this.completeTask(a.result === 'done' ? 'success' : 'error', signal); this.target = null; this.d.send({ ...this.base(), type: 'finish', result: a.result, say: a.say }); break;
      case 'expect': this.d.send({ ...this.base(), type: 'expect', description: a.description }); break;
      case 'wait': break;
    }
  }

  /** Refine the element with SAM from its Spark box, then send the target. */
  private async sendTarget(element: LayoutElement, h: Keyframe, image: { bytes: Uint8Array; mime: 'image/jpeg' },
    coordinates: ReturnType<typeof fullFrameCoordinates>, parsedElements: readonly LayoutElement[], signal: AbortSignal): Promise<void> {
    if (this.frameFromMemory) {
      // Stored polygons are already final: answering a known screen needs no model call at all.
      this.target = element;
      this.d.send(Target.parse({ ...this.base(), type: 'target', elementId: element.id, polygon: element.polygon,
        confidence: element.confidence, say: t(this.locale, 'found', { label: element.label, position: describePosition(element.polygon, this.locale) }) }));
      return;
    }
    const original = parsedElements.find(({ id }) => id === element.id) ?? element;
    const us = original.polygon.map(({ u }) => u), vs = original.polygon.map(({ v }) => v);
    const mask = await whileActive((this.frameModels ?? this.d.models).segmentByBox({ ...image, width: h.imageSize.w, height: h.imageSize.h }, {
      left: Math.min(...us) * h.imageSize.w, top: Math.min(...vs) * h.imageSize.h,
      right: Math.max(...us) * h.imageSize.w, bottom: Math.max(...vs) * h.imageSize.h,
    }).then(async (result) => { await this.d.onUsage?.({ kind: 'sam_image', images: 1 }); return result; })
      // Refinement is optional: with SAM unreachable, Spark's own box is still a usable target.
      .catch((error: unknown) => { if (error instanceof ModelsUnavailable) return { polygon: null, confidence: null, latencyMs: 0 }; throw error; }), signal);
    if (mask === CANCELLED || signal.aborted) return;
    const refined = mask.polygon && (coordinates ? coordinates.toScreen(mask.polygon) : mask.polygon);
    const polygon = refined || element.polygon;
    const target = Target.parse({ ...this.base(), type: 'target', elementId: element.id, polygon,
      confidence: Math.min(element.confidence, refined ? mask.confidence ?? element.confidence : element.confidence),
      say: t(this.locale, 'found', { label: element.label, position: describePosition(polygon, this.locale) }) });
    this.target = element;
    this.d.send(target);
  }

  private verify(h: Keyframe, before: Layout | null, after: Layout): 'ok' | 'wrong' | 'nochange' {
    const touched = this.hasSimTouch, actual = this.lastTap.simElementId;
    this.hasSimTouch = false;
    this.lastTap = { keyframeId: null, simElementId: null };
    if (touched && this.target && (actual === null || !simMatches(actual, this.target))) {
      this.d.send({ ...this.base(), type: 'verify', re: h.id, result: 'wrong',
        ...(actual !== null ? { actualElementId: actual } : {}), say: t(this.locale, 'pressed_other', { label: this.target.label }) });
      return 'wrong';
    } else if (!before || labelJaccard(before.elements, after.elements) < 0.7 || touched) {
      this.d.send({ ...this.base(), type: 'verify', re: h.id, result: 'ok', say: t(this.locale, 'verify_done') });
      return 'ok';
    }
    this.d.send({ ...this.base(), type: 'verify', re: h.id, result: 'nochange', say: t(this.locale, 'verify_nochange') });
    return 'nochange';
  }
}
