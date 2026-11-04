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
import { coversApplianceControls, usableRefinement } from './geometry-quality.ts';
import { AgentSession, type AgentTurn } from '../agent/loop.ts';
import { inferIntent, type RequestedMode } from '../agent/intent.ts';
import { readApplianceDisplay } from '../agent/tools.ts';
import { rulesPlanner, type Planner } from '../agent/planner.ts';
import { isSensitive } from '../agent/policy.ts';
import { firstSay, isMore, nextSay, summarize } from '../explore/summary.ts';
import type { MemoryService } from '../memory/service.ts';

/** Sim element ids are kebab-case versions of their labels ("pay-card" ↔ "Pay by card"). */
export const simMatches = (simElementId: string, el: LayoutElement) => tokenSetRatio(simElementId.replaceAll('-', ' '), el.label) >= 0.8;

import type { StartResult } from './types.ts';
export type TaskGate = () => Promise<StartResult>;
export type TaskOutcome = 'success' | 'error' | 'cancelled';
export interface PipelineDeps {
  /** Live turn deadline; mock/standalone ports retain their existing local policy. */
  turnTimeoutMs?: number;
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
  /** Say "New screen. I see …" when a read shows a screen the user hasn't heard (live gateway). */
  announceScreens?: boolean;
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
  private groundedTarget: { frameId: string; elementId: string } | null = null;
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
    this.task.abort();
    this.task = new AbortController();
    this.target = null;
    if (this.agent?.pinEntered()) {
      this.completeTask('success');
      this.d.send({ ...this.base(), type: 'finish', result: 'done', say: t(this.locale, 'pin_ready') });
    } else this.completeTask('cancelled');
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
    const task = this.task, signal = task.signal;
    if (signal.aborted) return;
    const timer = this.d.turnTimeoutMs === undefined ? undefined : setTimeout(() => {
      if (task !== this.task || signal.aborted) return;
      this.completeTask('error', signal);
      this.target = null;
      task.abort();
      this.d.send({ ...this.base(), type: 'mode', mode: 'offline', reason: t(this.locale, 'offline') });
    }, this.d.turnTimeoutMs);
    try { await this.processKeyframe(h, jpeg); }
    catch (error) {
      if (!signal.aborted) this.completeTask('error', signal);
      throw error;
    } finally { clearTimeout(timer); }
  }

  private async processKeyframe(h: Keyframe, jpeg: Uint8Array): Promise<void> {
    const signal = this.task.signal;
    if (signal.aborted) return;
    this.groundedTarget = null;
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
    const request = this.d.turnTimeoutMs === undefined ? {} : { signal };
    const parse = models.parseScreen(image, { locale: this.locale, ...(this.goal ? { goal: this.goal } : {}), ...request })
      .then(async (result) => { await this.d.onUsage?.({ kind: 'spark', ...result.usage }); return result; });
    const screen = h.kind === 'full' ? models.segmentByText({ bytes: jpeg, width: h.imageSize.w, height: h.imageSize.h, ...request }, 'touchscreen display')
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
    // Classification protects later frames even when this frame cannot establish a screen plane.
    this.sensitive ||= parsed.layout.sensitivity !== 'none';
    this.privatePlanning ||= this.privacy === 'private' || this.sensitive;
    let imageElements = parsed.layout.elements;
    if (parsed.layout.screenType === 'appliance' && parsed.layout.sensitivity === 'none' && models.groundControl
      && h.purpose !== 'verify' && !this.explore && !this.agent) {
      const selected = resolveByText(this.goal ?? '', imageElements);
      if (selected.kind === 'none' && h.kind === 'full') {
        this.target = null;
        this.completeTask('error', signal);
        this.d.send({ ...this.base(), type: 'ask', question: t(this.locale, 'button_not_found'), options: [] });
        return;
      }
      if (selected.kind === 'match') {
        const grounded = await this.groundElement(selected.element, h, image, models, signal);
        if (grounded === CANCELLED || !grounded || signal.aborted) return;
        imageElements = imageElements.map((element) => element.id === grounded.id ? grounded : element);
        this.groundedTarget = { frameId: h.id, elementId: grounded.id };
      }
    }
    let mapped = h.kind === 'full' ? fullFrameCoordinates(h.imageSize, screenMask, h.quad, parsed.layout.rotation) : null;
    if (h.kind === 'full' && parsed.layout.screenType === 'appliance' && parsed.layout.sensitivity === 'none') {
      const resolved = resolveByText(this.goal ?? '', imageElements);
      const required = resolved.kind === 'match' ? resolved.element : undefined;
      const usable = (space: typeof mapped) => coversApplianceControls(space, h.imageSize, imageElements, required);
      if (!usable(mapped) && models.groundControl) {
        for (const concept of ['control panel', 'remote control']) {
          const panel = await whileActive(models.segmentByText({ bytes: jpeg, width: h.imageSize.w, height: h.imageSize.h, ...request }, concept)
            .then(async (result) => { await this.d.onUsage?.({ kind: 'sam_image', images: 1 }); return result.polygon; }).catch(() => null), signal);
          if (panel === CANCELLED || signal.aborted) return;
          mapped = fullFrameCoordinates(h.imageSize, panel, undefined, parsed.layout.rotation);
          if (usable(mapped)) break;
        }
      }
      if (!usable(mapped)) mapped = fullFrameCoordinates(h.imageSize, null, h.quad, parsed.layout.rotation);
      if (!usable(mapped)) {
        // Flat glass touch controls can surround an LCD, or have no display at all.
        const panel = await whileActive(models.segmentByText({ bytes: jpeg, width: h.imageSize.w, height: h.imageSize.h, ...request }, 'appliance')
          .then(async (result) => { await this.d.onUsage?.({ kind: 'sam_image', images: 1 }); return result.polygon; }).catch(() => null), signal);
        if (panel === CANCELLED || signal.aborted) return;
        mapped = fullFrameCoordinates(h.imageSize, panel, undefined, parsed.layout.rotation);
        if (!usable(mapped)) mapped = null;
      }
    }
    coordinates = mapped;
    if (h.kind === 'full' && !mapped) {
      this.d.send({ ...this.base(), type: 'ask', question: t(this.locale, 'no_screen'), options: [], reason: 'reframe' });
      return;
    }
    const elements = mapped ? imageElements.flatMap((element) => {
      const polygon = mapped.toScreen(element.polygon);
      return polygon ? [{ ...element, polygon }] : [];
    }) : imageElements;
    layout = Layout.parse({ ...this.base(), type: 'layout', ...parsed.layout, elements,
      ...(mapped ? { screenQuad: mapped.screenQuad } : {}),
      fingerprint: layoutFingerprint(elements), source: 'model' });
    parsedElements = imageElements;
    this.remember(h, layout);
    }
    this.layout = layout;
    this.sensitive = layout.sensitivity !== 'none';
    this.privatePlanning ||= this.privacy === 'private' || this.sensitive;
    this.d.send(layout);
    // Announce each screen the user hasn't heard yet, before any target or question about it.
    if (this.d.announceScreens && !this.sensitive && h.purpose !== 'explore' && !this.explore && (!before || labelJaccard(before.elements, layout.elements) < 0.7)) {
      const labels = listLabels(layout.elements, 6, this.locale);
      if (labels) this.d.send({ ...this.base(), type: 'say', priority: 'state', text: t(this.locale, 'new_screen', { labels }).slice(0, 500) });
    }
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
      const result = this.verify(h, before, layout, this.agent?.applianceDisplayChanged(this.applianceDisplay(layout,h,coordinates)) ?? false);
      if (!this.agent && result === 'ok') this.completeTask('success', signal);
      if (this.agent && result === 'ok' && pressed) {
        this.agent.pressed(pressed, layout);
        await turn(layout);
      } else if(this.agent?.applianceTask && result === 'nochange') await turn(layout);
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

  private applianceDisplay(layout: Layout,h:Keyframe,coordinates:ReturnType<typeof fullFrameCoordinates>):string|null {
    const tokens=h.ocrTokens.flatMap(token=>{
      if(!coordinates) return [token];
      const {u,v,w,h}=token.box;
      const polygon=coordinates.toScreen([{u,v},{u:u+w,v},{u:u+w,v:v+h},{u,v:v+h}]);
      if(!polygon) return [];
      const xs=polygon.map(p=>p.u),ys=polygon.map(p=>p.v),left=Math.min(...xs),top=Math.min(...ys);
      return [{text:token.text,box:{u:left,v:top,w:Math.max(...xs)-left,h:Math.max(...ys)-top}}];
    });
    return readApplianceDisplay(layout.elements,tokens);
  }

  /** One agent decision for this screen, sent as fp.v1 messages. */
  private async agentTurn(layout: Layout, h: Keyframe, image: { bytes: Uint8Array; mime: 'image/jpeg' },
    coordinates: ReturnType<typeof fullFrameCoordinates>, parsedElements: readonly LayoutElement[], signal: AbortSignal): Promise<void> {
    const agent = this.agent!;
    const turn = await whileActive<AgentTurn>(agent.decide(layout, signal, this.applianceDisplay(layout,h,coordinates)), signal).catch(() => null);
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
  private async groundElement(element: LayoutElement, h: Keyframe, image: { bytes: Uint8Array; mime: 'image/jpeg' },
    models: ModelPort, signal: AbortSignal): Promise<LayoutElement | null | typeof CANCELLED> {
    if (!models.groundControl) return element;
    const result = await whileActive(models.groundControl({ ...image, width: h.imageSize.w, height: h.imageSize.h, signal },
      { locale: this.locale, goal: this.goal ?? element.label, element })
      .then(async (result) => { await this.d.onUsage?.({ kind: 'spark', ...result.usage }); return result; })
      .catch((error: unknown) => { if (error instanceof ModelsUnavailable) return null; throw error; }), signal);
    if (result === CANCELLED || signal.aborted) return CANCELLED;
    if (!result || result.actuation !== 'press' || !result.polygon) {
      this.target = null;
      this.completeTask('error', signal);
      const unsupported = result?.actuation === 'turn' || result?.actuation === 'slide';
      this.d.send({ ...this.base(), type: 'ask', question: t(this.locale, unsupported ? 'press_only' : 'target_unclear'), options: [],
        ...(unsupported ? {} : { reason: 'reframe' as const }) });
      return null;
    }
    return { ...element, polygon: result.polygon, confidence: Math.min(element.confidence, result.confidence) };
  }

  private async sendTarget(element: LayoutElement, h: Keyframe, image: { bytes: Uint8Array; mime: 'image/jpeg' },
    coordinates: ReturnType<typeof fullFrameCoordinates>, parsedElements: readonly LayoutElement[], signal: AbortSignal): Promise<void> {
    if (isSensitive(element) && !this.agent?.allowsGuide(element)) {
      this.target = null;
      this.d.send({ ...this.base(), type: 'say', priority: 'safety', text: t(this.locale, 'confirm_first') });
      return;
    }
    if (this.frameFromMemory) {
      // Stored polygons are already final: answering a known screen needs no model call at all.
      this.target = element;
      this.d.send(Target.parse({ ...this.base(), type: 'target', elementId: element.id, polygon: element.polygon,
        confidence: element.confidence, say: t(this.locale, 'found', { label: element.label, position: describePosition(element.polygon, this.locale) }) }));
      return;
    }
    let original = parsedElements.find(({ id }) => id === element.id) ?? element;
    const frameModels = this.frameModels ?? this.d.models;
    if (this.layout?.screenType === 'appliance' && frameModels.groundControl
      && (this.groundedTarget?.frameId !== h.id || this.groundedTarget.elementId !== element.id)) {
      const grounded = await this.groundElement(original, h, image, frameModels, signal);
      if (grounded === CANCELLED || !grounded || signal.aborted) return;
      const polygon = coordinates ? coordinates.toScreen(grounded.polygon) : grounded.polygon;
      if (!polygon) {
        this.target = null;
        this.d.send({ ...this.base(), type: 'ask', question: t(this.locale, 'target_unclear'), options: [], reason: 'reframe' });
        return;
      }
      original = grounded;
      element = { ...grounded, polygon };
    }
    const us = original.polygon.map(({ u }) => u), vs = original.polygon.map(({ v }) => v);
    const mask = await whileActive((this.frameModels ?? this.d.models).segmentByBox({ ...image, width: h.imageSize.w, height: h.imageSize.h,
      ...(this.d.turnTimeoutMs === undefined ? {} : { signal }) }, {
      left: Math.min(...us) * h.imageSize.w, top: Math.min(...vs) * h.imageSize.h,
      right: Math.max(...us) * h.imageSize.w, bottom: Math.max(...vs) * h.imageSize.h,
    }).then(async (result) => { await this.d.onUsage?.({ kind: 'sam_image', images: 1 }); return result; })
      // Refinement is optional: with SAM unreachable, Spark's own box is still a usable target.
      .catch((error: unknown) => { if (error instanceof ModelsUnavailable) return { polygon: null, confidence: null, latencyMs: 0 }; throw error; }), signal);
    if (mask === CANCELLED || signal.aborted) return;
    const accepted = usableRefinement(original.polygon, mask.polygon);
    const refined = accepted && (coordinates ? coordinates.toScreen(accepted) : accepted);
    const polygon = refined || element.polygon;
    const target = Target.parse({ ...this.base(), type: 'target', elementId: element.id, polygon,
      confidence: Math.min(element.confidence, refined ? mask.confidence ?? element.confidence : element.confidence),
      say: t(this.locale, 'found', { label: element.label, position: describePosition(polygon, this.locale) }) });
    this.target = element;
    this.d.send(target);
  }

  private verify(h: Keyframe, before: Layout | null, after: Layout, displayChanged=false): 'ok' | 'wrong' | 'nochange' {
    const touched = this.hasSimTouch, actual = this.lastTap.simElementId;
    this.hasSimTouch = false;
    this.lastTap = { keyframeId: null, simElementId: null };
    if (touched && this.target && (actual === null || !simMatches(actual, this.target))) {
      this.d.send({ ...this.base(), type: 'verify', re: h.id, result: 'wrong',
        ...(actual !== null ? { actualElementId: actual } : {}), say: t(this.locale, 'pressed_other', { label: this.target.label }) });
      return 'wrong';
    } else if (!before || labelJaccard(before.elements, after.elements) < 0.7 || touched || displayChanged) {
      this.d.send({ ...this.base(), type: 'verify', re: h.id, result: 'ok', say: t(this.locale, 'verify_done') });
      return 'ok';
    }
    this.d.send({ ...this.base(), type: 'verify', re: h.id, result: 'nochange', say: t(this.locale, 'verify_nochange') });
    return 'nochange';
  }
}
