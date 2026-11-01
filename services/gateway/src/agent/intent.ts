import type { Intent, RequestedMode } from '@fingerpost/protocol';

/**
 * Verbs that imply a multi-step task.
 * "press" and "tap" are filtered: they imply a single-target guide.
 */
const TASK_VERBS = /\b(order|buy|pay|book|check\s*in|ticket|और|comprar|pagar|pedir)\b/i;
/**
 * Two or more distinct nouns joined by "and" (not "start order", which is a compound label).
 * The first and second word groups must differ after stripping filler.
 */
const MULTI_NOUN_AND = /\b(\w+)\s+.*\band\b\s+(?!\1\b)(\w+)\b/i;
const EXPLORE_RE = /\b(what('?s|\s+is)\s+on|read the screen|explore|क्या\s+है|qué\s+hay)\b/i;

/** Filler words that don't count toward task intent detection. */
const INTENT_FILLER = /\b(press|tap|touch|push|click|select|choose|the|a|an|button|key|please|on|option)\b/gi;

/**
 * Infer the user's intent from a goal string and the hello mode.
 * Explicit mode overrides inference unless `auto`.
 */
export function inferIntent(goal: string, mode: RequestedMode): Intent {
  if (mode !== 'auto') return mode as Intent;
  if (EXPLORE_RE.test(goal)) return 'explore';
  // Strip filler words before checking task verbs, so "press start order" doesn't match "order"
  const stripped = goal.replace(INTENT_FILLER, ' ').replace(/\s+/g, ' ').trim();
  if (TASK_VERBS.test(stripped)) return 'task';
  if (MULTI_NOUN_AND.test(stripped)) return 'task';
  return 'guide';
}
