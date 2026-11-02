import { ulid } from 'ulid';
import type { Layout, LayoutElement, Locale, Priority } from '@fingerpost/protocol';
import { t } from '../i18n/strings.ts';
import { resolveByText, tokenSetRatio } from '../resolve/match.ts';
import { listLabels } from '../resolve/describe.ts';
import { elementKey, isSensitive, Policy } from './policy.ts';
import { rulesPlanner, screenAmount, type AgentState, type Planner, type ToolCall } from './planner.ts';
import { layoutSummary } from './tools.ts';

/** What the session asks the pipeline to send for one screen. `says` go out first, then the action. */
export type AgentAction =
  | { kind: 'target'; element: LayoutElement }
  | { kind: 'ask'; id: string; question: string; options: string[] }
  | { kind: 'confirm'; id: string; summary: string; amount?: { value: number; currency: string } }
  | { kind: 'finish'; result: 'done' | 'failed'; say: string }
  | { kind: 'expect'; description: string }
  | { kind: 'wait' };
export interface AgentTurn { says: { text: string; priority: Priority }[]; action: AgentAction }

export interface AgentDeps {
  planner: Planner;
  /** Used when the main planner throws, and on the last attempt of a turn. Defaults to the rules planner. */
  fallback?: Planner;
  now?: () => number;
  onUsage?: (u: { inputTokens: number; outputTokens: number }) => void | Promise<void>;
  onPlannerError?: (plannerId: string, error: unknown) => void;
  /** B4-4: the language of everything this session says. Default en. */
  locale?: Locale;
}

/** Planner calls per screen: speech and refused calls loop back; the last attempt uses the fallback planner. */
const ATTEMPTS = 3;
// \b does not see Devanagari as word characters, so the word end is spelled out.
const END = '(?=$|[\\s,.!?।])';
const YES = new RegExp(`^(yes|yeah|yep|yup|ok|okay|sure|confirm|haan|हाँ|हां|sí|si|claro)${END}`, 'iu');
const NO = new RegExp(`^(no|nope|nah|cancel|stop|nahin|नहीं)${END}`, 'iu');

/** Spoken yes/no. Anything else is null: an unclear reply never accepts a payment. */
export function parseYesNo(text: string): boolean | null {
  const t = text.trim().toLowerCase().replace(/[.!?,]+$/u, '');
  if (YES.test(t)) return true;
  if (NO.test(t)) return false;
  return null;
}

type Pending = { kind: 'ask' | 'loop' | 'confirm'; id: string } | null;

/**
 * Multi-step task brain (design §4.3), one decision per screen. The pipeline owns keyframes, parsing, SAM
 * and verification; this session owns the plan. Rules that keep the user safe live here and in Policy,
 * never only in the prompt: pay needs an accepted confirm with the on-screen amount, 20 steps / 5 minutes,
 * and the same screen three times asks to go back.
 */
export class AgentSession {
  readonly goal: string;
  private answers: string[] = [];
  private history: string[] = [];
  private pending: Pending = null;
  /** Questions already answered (often by voice): the device's own answer for the same id is a duplicate. */
  private readonly answered = new Set<string>();
  private wantBack = false;
  private loopScreen: string | null = null;
  private paidOn: string | null = null;
  private finished = false;
  private readonly policy: Policy;
  private readonly fallback: Planner;

  private readonly d: AgentDeps;

  constructor(goal: string, d: AgentDeps) {
    this.d = d;
    this.goal = goal;
    this.policy = new Policy({ now: d.now });
    this.fallback = d.fallback ?? rulesPlanner();
  }

  private get locale(): Locale { return this.d.locale ?? 'en'; }

  get done() { return this.finished; }
  get awaiting(): Pending { return this.pending; }

  /** Reply to an ask. False when nothing with this id is pending (the caller treats the text as a new goal). */
  onAnswer(re: string, text: string): boolean {
    if (this.answered.has(re)) return true;
    const p = this.pending;
    if (!p || p.id !== re || p.kind === 'confirm') return false;
    this.pending = null;
    this.answered.add(re);
    if (p.kind === 'loop') {
      const yes = parseYesNo(text);
      if (yes === true) this.wantBack = true;
      else if (this.loopScreen) this.policy.forgetScreen(this.loopScreen);
      return true;
    }
    this.answers.push(text.slice(0, 200));
    return true;
  }

  /** Reply to a confirm. Returns 'declined' so the pipeline can end the task; acceptance binds to this id only. */
  onConfirmReply(re: string, accepted: boolean): 'accepted' | 'declined' | 'ignored' {
    const p = this.pending;
    if (!p || p.kind !== 'confirm' || p.id !== re) return 'ignored';
    this.pending = null;
    if (accepted && this.policy.accept(re)) return 'accepted';
    this.finished = true;
    return 'declined';
  }

  /**
   * A final voice transcript while a question is open answers it. Returns null when nothing was pending.
   * For a confirm, anything but a clear yes declines (guidance-spec §8), the same rule as the phone.
   */
  onTranscript(text: string): 'answered' | 'accepted' | 'declined' | null {
    const p = this.pending;
    if (!p) return null;
    if (p.kind !== 'confirm') return this.onAnswer(p.id, text) ? 'answered' : null;
    return this.onConfirmReply(p.id, parseYesNo(text) === true) === 'accepted' ? 'accepted' : 'declined';
  }

  /** A verified press. After a confirmed payment press the session waits for PIN entry or a new screen. */
  pressed(el: LayoutElement, layout: Layout): void {
    if (isSensitive(el)) this.paidOn = layout.fingerprint;
  }

  /** The device entered PIN mode: the task's cloud part is over. */
  pinEntered(): boolean {
    if (this.finished || this.paidOn === null) return false;
    this.finished = true;
    return true;
  }

  async decide(layout: Layout, signal?: AbortSignal): Promise<AgentTurn> {
    const says: AgentTurn['says'] = [];
    const turn = (action: AgentAction): AgentTurn => ({ says, action });
    if (this.finished || this.pending) return turn({ kind: 'wait' });

    if (this.paidOn !== null) {
      if (layout.fingerprint === this.paidOn) return turn({ kind: 'wait' });
      this.finished = true;
      return turn({ kind: 'finish', result: 'done', say: t(this.locale, 'order_done') });
    }

    const verdict = this.policy.step(layout.fingerprint);
    if (verdict === 'budget') {
      this.finished = true;
      return turn({ kind: 'finish', result: 'failed', say: t(this.locale, 'too_many_steps') });
    }

    if (this.wantBack) {
      this.wantBack = false;
      this.policy.forgetScreen(layout.fingerprint);
      const back = layout.elements.find((el) => el.role === 'back');
      if (back) return turn({ kind: 'target', element: back });
      says.push({ text: t(this.locale, 'no_back'), priority: 'state' });
    } else if (verdict === 'loop') {
      const id = ulid();
      this.pending = { kind: 'loop', id };
      this.loopScreen = layout.fingerprint;
      return turn({ kind: 'ask', id, question: t(this.locale, 'ask_go_back'), options: [t(this.locale, 'yes'), t(this.locale, 'no')] });
    }

    let feedback: string | null = null;
    try {
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        if (signal?.aborted) return turn({ kind: 'wait' });
        const call = await this.plan(layout, feedback, attempt === ATTEMPTS - 1, signal);
        const r = this.apply(call, layout);
        if (r.say) says.push(r.say);
        if (r.action) return turn(r.action);
        feedback = r.feedback ?? null;
      }
      this.finished = true;
      return turn({ kind: 'finish', result: 'failed', say: t(this.locale, 'not_sure_next') });
    } finally {
      this.history.push(layoutSummary(layout.elements));
      if (this.history.length > 5) this.history.shift();
    }
  }

  private state(layout: Layout, feedback: string | null): AgentState {
    return {
      goal: this.goal, answers: [...this.answers], history: [...this.history], feedback, locale: this.locale,
      screen: { fingerprint: layout.fingerprint, screenType: layout.screenType, elements: layout.elements },
      confirmed: layout.elements.filter((el) => this.policy.hasAccepted(el)).map(elementKey),
    };
  }

  private async plan(layout: Layout, feedback: string | null, last: boolean, signal?: AbortSignal): Promise<ToolCall> {
    const state = this.state(layout, feedback);
    const planner = last ? this.fallback : this.d.planner;
    try {
      const r = await planner.next(state, signal);
      if (r.usage) await this.d.onUsage?.(r.usage);
      return r.call;
    } catch (error) {
      if (signal?.aborted || planner === this.fallback) throw error;
      this.d.onPlannerError?.(planner.id, error);
      return (await this.fallback.next(state, signal)).call;
    }
  }

  /** One tool call → an action that ends the turn, or speech/feedback and another attempt. */
  private apply(call: ToolCall, layout: Layout): { action?: AgentAction; say?: AgentTurn['says'][number]; feedback?: string } {
    const a = call.arguments;
    const els = layout.elements;
    switch (call.name) {
      case 'guide_to': {
        const id = String(a.element_id ?? '');
        const el = els.find((e) => e.id === id) ?? els.find((e) => tokenSetRatio(e.label, id) >= 0.9);
        if (!el) return { feedback: `guide_to refused: no element with id "${id}" on this screen. Use an id from screen.elements.` };
        const check = this.policy.allowGuide(el);
        if (!check.ok) return { feedback: `guide_to "${el.label}" refused: role ${el.role} needs confirm_with_user with the on-screen amount first.` };
        return { action: { kind: 'target', element: el } };
      }
      case 'confirm_with_user': {
        const ids = Array.isArray(a.element_ids) ? a.element_ids.map(String) : [];
        let covered = els.filter((el) => isSensitive(el) && ids.includes(el.id));
        if (!covered.length) covered = els.filter(isSensitive);
        if (!covered.length) return { feedback: 'confirm_with_user refused: there is no pay, confirm or submit button on this screen.' };
        const shown = screenAmount(els);
        let summary = String(a.summary ?? '').trim().slice(0, 300) || t(this.locale, 'your_order');
        // The user must hear the amount the screen shows, whatever the model wrote.
        if (shown && !summary.includes(String(shown.value))) summary = `${summary}, ${shown.label}`.slice(0, 300);
        const id = ulid();
        this.policy.recordConfirm(id, covered);
        this.pending = { kind: 'confirm', id };
        return { action: { kind: 'confirm', id, summary, ...(shown ? { amount: { value: shown.value, currency: shown.currency } } : {}) } };
      }
      case 'ask_user': {
        const question = String(a.question ?? '').trim().slice(0, 300);
        if (!question) return { feedback: 'ask_user refused: empty question.' };
        const options = (Array.isArray(a.options) ? a.options : []).map((o) => String(o).trim().slice(0, 100)).filter(Boolean).slice(0, 8);
        const id = ulid();
        this.pending = { kind: 'ask', id };
        return { action: { kind: 'ask', id, question, options } };
      }
      case 'say': {
        const text = String(a.text ?? '').trim().slice(0, 280);
        return text ? { say: { text, priority: 'info' }, feedback: 'You already spoke. Now choose the next action.' } : {};
      }
      case 'go_back': {
        const back = els.find((el) => el.role === 'back');
        return back ? { action: { kind: 'target', element: back } } : { feedback: 'go_back refused: no Back button on this screen.' };
      }
      case 'finish': {
        this.finished = true;
        const say = String(a.reason ?? '').trim().slice(0, 280) || t(this.locale, 'verify_done');
        return { action: { kind: 'finish', result: a.result === 'done' ? 'done' : 'failed', say } };
      }
      case 'wait_for_screen_change':
        return { action: { kind: 'expect', description: String(a.expected ?? 'The screen changes.').slice(0, 300) || 'The screen changes.' } };
      case 'get_layout':
        return { action: { kind: 'wait' } };
      case 'find_element': {
        const r = resolveByText(String(a.description ?? ''), els);
        const text = r.kind === 'match' ? t(this.locale, 'found_short', { label: r.element.label })
          : t(this.locale, 'i_see', { labels: listLabels(els.filter((e) => e.role !== 'text'), 5, this.locale) || t(this.locale, 'nothing') });
        return { say: { text, priority: 'info' }, feedback: 'find_element done. Now choose the next action.' };
      }
      default:
        return { feedback: `Unknown tool "${call.name}".` };
    }
  }
}
