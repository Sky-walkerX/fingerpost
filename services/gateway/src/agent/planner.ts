import { readFileSync } from 'node:fs';
import type OpenAI from 'openai';
import { z } from 'zod';
import type { LayoutElement, Locale, ScreenType } from '@fingerpost/protocol';
import { joinList, t } from '../i18n/strings.ts';
import { MODELS } from '../models/meta-client.ts';
import { normalizeLabel } from '../parse/spark-parse.ts';
import { elementKey, isSensitive } from './policy.ts';
import { TOOL_DEFS } from './tools.ts';

export const AGENT_PROMPT_ID = 'agent.v1';
const SYSTEM_PROMPT = readFileSync(new URL(`../../prompts/${AGENT_PROMPT_ID}.md`, import.meta.url), 'utf8');

/** Everything a planner sees: text only (labels and roles), never an image. */
export interface AgentState {
  goal: string;
  /** The user's answers to earlier ask_user questions, oldest first. */
  answers: string[];
  screen: { fingerprint: string; screenType: ScreenType; elements: LayoutElement[] };
  /** Label/role summaries of the last screens (≤5), oldest first. */
  history: string[];
  /** Element keys (role:label) the user accepted a confirm for. */
  confirmed: string[];
  /** Why the previous tool call was refused, so the model can correct itself. */
  feedback: string | null;
  /** B4-4: the user's language; questions, summaries and reasons are spoken in it. Default en. */
  locale?: Locale;
}

export interface ToolCall { name: string; arguments: Record<string, unknown> }
export interface PlanResult { call: ToolCall; usage?: { inputTokens: number; outputTokens: number } }
export interface Planner { readonly id: string; next(state: AgentState, signal?: AbortSignal): Promise<PlanResult> }

// ---------------------------------------------------------------------------------------------------------
// Amount on screen. The confirm amount is always read from the layout, never trusted from the model.

const CURRENCY: Record<string, string> = { '₹': 'INR', rs: 'INR', 'rs.': 'INR', inr: 'INR', $: 'USD', usd: 'USD', '€': 'EUR', eur: 'EUR', '£': 'GBP', gbp: 'GBP' };
const AMOUNT_RE = /(₹|rs\.?|inr|\$|usd|€|eur|£|gbp)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)|([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(₹|rs\.?|inr|usd|eur|gbp)\b/i;

export interface ScreenAmount { label: string; value: number; currency: string }

function amountIn(label: string): Omit<ScreenAmount, 'label'> | null {
  const m = AMOUNT_RE.exec(label);
  if (!m) return null;
  const symbol = (m[1] ?? m[4] ?? '').toLowerCase();
  const value = Number((m[2] ?? m[3] ?? '').replaceAll(',', ''));
  const currency = CURRENCY[symbol];
  return currency && Number.isFinite(value) ? { value, currency } : null;
}

/** Prefer a "total"/"amount" text; otherwise the only amount on a text element. Ambiguous → null. */
export function screenAmount(elements: readonly LayoutElement[]): ScreenAmount | null {
  const found = elements.filter((el) => el.role === 'text').flatMap((el) => {
    const a = amountIn(el.label);
    return a ? [{ label: el.label, ...a }] : [];
  });
  const total = found.find((a) => /\b(total|amount|to pay|payable|कुल|importe)\b/i.test(a.label));
  if (total) return total;
  return found.length === 1 ? found[0]! : null;
}

// ---------------------------------------------------------------------------------------------------------
// Rules planner: deterministic. Mock mode, tests, and the fallback when the model is down or misbehaves.

const STOP = new Set(['a', 'an', 'the', 'and', 'i', 'want', 'to', 'please', 'me', 'my', 'some', 'one', 'order', 'pay', 'buy',
  'get', 'for', 'with', 'by', 'card', 'of', 'it', 'press', 'tap', 'then', 'now', 'can', 'you', 'like', 'would', 'need', 'give', 'just']);
const CATEGORIES: Record<string, readonly string[]> = {
  drink: ['cola', 'coke', 'pepsi', 'soda', 'water', 'juice', 'tea', 'coffee', 'drink', 'lemonade', 'sprite', 'shake'],
  burger: ['burger', 'cheeseburger', 'hamburger', 'whopper', 'sandwich'],
  side: ['fries', 'chips', 'side', 'nuggets', 'salad'],
};
const NAV = /^(start|start order|order now|order here|begin|next|continue|get started|tap to start|touch to start)$/;
const WANTS_PAY = /\b(pay|checkout|check out|purchase|buy|pagar|भुगतान)\b/i;

const words = (s: string) => normalizeLabel(s).split(' ').filter(Boolean);
const singular = (w: string) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
/** Label words that name the thing: prices and numbers dropped. */
const labelWords = (label: string) => words(label).filter((w) => !/[0-9₹$€£]/.test(w)).map(singular);

function wanted(state: AgentState): string[] {
  return [state.goal, ...state.answers].flatMap(words).filter((w) => !STOP.has(w) && !/[0-9]/.test(w)).map(singular);
}

const actionable = (el: LayoutElement) => el.role !== 'text' && el.role !== 'back' && el.role !== 'cancel' && el.role !== 'input' && !isSensitive(el);

function score(el: LayoutElement, want: readonly string[]): number {
  const lw = labelWords(el.label);
  if (lw.some((w) => want.includes(w))) return 3;
  if (lw.some((w) => CATEGORIES[w]?.some((item) => want.includes(item)))) return 2;
  if (NAV.test(normalizeLabel(el.label))) return 1;
  return 0;
}


export function rulesPlanner(): Planner {
  return {
    id: 'rules.v1',
    async next(state) {
      const locale = state.locale ?? 'en';
      const els = state.screen.elements;
      const want = wanted(state);
      const sensitive = els.filter(isSensitive);
      const candidates = els.filter(actionable).map((el) => ({ el, s: score(el, want) })).filter((c) => c.s > 0);
      const best = candidates.sort((a, b) => b.s - a.s)[0];
      const itemOnScreen = best && best.s >= 2;

      if (sensitive.length && !itemOnScreen && WANTS_PAY.test(state.goal)) {
        const target = sensitive.find((el) => state.confirmed.includes(elementKey(el)));
        if (target) return { call: { name: 'guide_to', arguments: { element_id: target.id, why: 'Pay' } } };
        const amount = screenAmount(els);
        const items = want.filter((w) => !CATEGORIES[w]).join(' ');
        const what = items ? items.charAt(0).toUpperCase() + items.slice(1) : t(locale, 'your_order');
        return { call: { name: 'confirm_with_user', arguments: {
          summary: amount ? `${what}, ${amount.label}` : what,
          amount_value: amount?.value ?? 0, amount_currency: amount?.currency ?? 'INR',
          element_ids: [sensitive[0]!.id],
        } } };
      }
      if (best) return { call: { name: 'guide_to', arguments: { element_id: best.el.id, why: best.el.label } } };

      const choices = els.filter(actionable);
      if (choices.length >= 2 && choices.length <= 8 && state.answers.length < 2) {
        const labels = choices.map((el) => el.label.slice(0, 100));
        return { call: { name: 'ask_user', arguments: { question: t(locale, 'ask_which_one', { options: joinList(labels, 'or', locale) }).slice(0, 300), options: labels } } };
      }
      const seen = joinList(choices.map((el) => el.label).slice(0, 6), 'or', locale) || t(locale, 'nothing_to_press');
      return { call: { name: 'finish', arguments: { result: 'failed', reason: t(locale, 'not_found_here', { labels: seen }).slice(0, 280) } } };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------
// Spark planner: OpenAI-compatible tool calling on the Meta Model API, text-only context.

/** The planner only gets tools that end a turn or speak; layout and search are given up front. */
const PLANNER_TOOLS = TOOL_DEFS.filter((t) => ['guide_to', 'ask_user', 'confirm_with_user', 'say', 'go_back', 'finish'].includes(t.function.name));

const Args = {
  guide_to: z.object({ element_id: z.string().min(1), why: z.string() }),
  ask_user: z.object({ question: z.string().min(1).max(300), options: z.array(z.string().min(1).max(100)).max(8) }),
  confirm_with_user: z.object({ summary: z.string().min(1).max(300), amount_value: z.number(), amount_currency: z.string(), element_ids: z.array(z.string()) }),
  say: z.object({ text: z.string().min(1).max(280) }),
  go_back: z.object({}),
  finish: z.object({ result: z.enum(['done', 'failed']), reason: z.string().min(1).max(280) }),
} as const;

const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', hi: 'Hindi', es: 'Spanish' };

export function stateMessage(state: AgentState): string {
  return JSON.stringify({
    goal: state.goal,
    answers: state.answers,
    confirmed_elements: state.confirmed,
    previous_screens: state.history,
    screen: { type: state.screen.screenType, elements: state.screen.elements.map((el) => ({ id: el.id, label: el.label, role: el.role })) },
    ...(state.feedback ? { feedback: state.feedback } : {}),
    // Spoken text (questions, summaries, reasons) in the user's language; labels stay as the screen shows them.
    ...(state.locale && state.locale !== 'en' ? { reply_language: LANGUAGE_NAMES[state.locale] } : {}),
  });
}

export function sparkPlanner(client: OpenAI): Planner {
  return {
    id: AGENT_PROMPT_ID,
    async next(state, signal) {
      const response = await client.chat.completions.create({
        model: MODELS.spark,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: stateMessage(state) }],
        tools: PLANNER_TOOLS,
        tool_choice: 'required',
        parallel_tool_calls: false,
      }, { headers: { 'X-Prompt-Id': AGENT_PROMPT_ID }, ...(signal ? { signal } : {}) });
      const call = response.choices[0]?.message.tool_calls?.[0];
      if (!call || call.type !== 'function') throw new Error('Planner returned no tool call');
      const name = call.function.name as keyof typeof Args;
      const schema = Args[name];
      if (!schema) throw new Error('Planner called an unknown tool');
      const args = schema.parse(JSON.parse(call.function.arguments)) as Record<string, unknown>;
      return { call: { name, arguments: args },
        usage: { inputTokens: response.usage?.prompt_tokens ?? 0, outputTokens: response.usage?.completion_tokens ?? 0 } };
    },
  };
}
