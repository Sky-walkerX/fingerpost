import { applianceGoal } from './appliance-task.ts';
import type { z } from 'zod';
import type { Intent as IntentSchema, RequestedMode as RequestedModeSchema } from '@fingerpost/protocol';

export type Intent = z.infer<typeof IntentSchema>;
export type RequestedMode = z.infer<typeof RequestedModeSchema>;

/**
 * Verbs that imply a multi-step task.
 * "press" and "tap" are filtered: they imply a single-target guide.
 */
const TASK_VERBS = /\b(buy|pay|book|check\s*in|ticket|और|comprar|pagar|pedir)\b/i;
/** "order" is a task verb only if it's a standalone verb, not part of a compound label like "start order". */
const ORDER_VERB = /\border\b/i;
const ORDER_AS_LABEL = /\b(start|place|my|view|the|review|cancel)\s+order\b|\badd\s+(it\s+)?to\s+(my\s+)?order\b/i;
/**
 * Two or more distinct nouns joined by "and" (not "start order", which is a compound label).
 * The first and second word groups must differ after stripping filler.
 */
const MULTI_NOUN_AND = /\b(\w+)\s+.*\band\b\s+(?!\1\b)(\w+)\b/i;
const EXPLORE_RE = /\b(what('?s|\s+is)\s+on|read (the|this) screen|read it|describe (the|this) screen|what (do|can) you see|what can i (press|tap)|what are (the|my) options|explore|क्या\s+है|qué\s+hay)\b/i;

/** Filler words that don't count toward task intent detection. */
const INTENT_FILLER = /\b(press|tap|touch|push|click|select|choose|the|a|an|button|key|please|on|option)\b/gi;

/**
 * Infer the user's intent from a goal string and the hello mode.
 * Explicit mode overrides inference unless `auto`.
 */
export function inferIntent(goal: string, mode: RequestedMode): Intent {
  if (mode !== 'auto') return mode;
  if (applianceGoal(goal)) return 'task';
  if (EXPLORE_RE.test(goal)) return 'explore';
  // Strip filler words before checking task verbs, so "press start order" doesn't match "order"
  const stripped = goal.replace(INTENT_FILLER, ' ').replace(/\s+/g, ' ').trim();
  if (TASK_VERBS.test(stripped)) return 'task';
  if (ORDER_VERB.test(stripped) && !ORDER_AS_LABEL.test(goal)) return 'task';
  if (MULTI_NOUN_AND.test(stripped)) return 'task';
  return 'guide';
}
