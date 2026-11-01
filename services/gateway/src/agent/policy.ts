import type { LayoutElement } from '@fingerpost/protocol';
import { normalizeLabel } from '../parse/spark-parse.ts';

export const SENSITIVE_ROLES: ReadonlySet<string> = new Set(['pay', 'confirm', 'submit']);
export const isSensitive = (el: Pick<LayoutElement, 'role'>) => SENSITIVE_ROLES.has(el.role);

/**
 * Live Spark numbers elements e1, e2, … in reading order, so the same button can get a new id on the
 * next parse. A confirm therefore covers an element by role + normalized label, never by id alone.
 */
export const elementKey = (el: Pick<LayoutElement, 'role' | 'label' | 'textNorm'>) =>
  `${el.role}:${el.textNorm ?? normalizeLabel(el.label)}`;

export type StepVerdict = 'ok' | 'budget' | 'loop';

/**
 * Policy layer outside the model (design §4.3). The model never decides these:
 *   1. guide_to on role pay|confirm|submit is refused unless a confirm covering that element was accepted,
 *      and acceptance is bound to that confirm's id (a yes to an earlier question unlocks nothing new);
 *   2. step budget: 20 steps or 5 minutes;
 *   3. loop detection: the same screen fingerprint 3 times.
 */
export class Policy {
  private readonly confirms = new Map<string, Set<string>>();
  private readonly accepted = new Set<string>();
  private steps = 0;
  private startMs: number | null = null;
  private readonly seen = new Map<string, number>();

  private readonly maxSteps: number;
  private readonly maxMs: number;
  private readonly now: () => number;

  constructor(opts: { maxSteps?: number; maxMs?: number; now?: (() => number) | undefined } = {}) {
    this.maxSteps = opts.maxSteps ?? 20;
    this.maxMs = opts.maxMs ?? 5 * 60_000;
    this.now = opts.now ?? Date.now;
  }

  allowGuide(el: LayoutElement): { ok: true } | { ok: false; say: string } {
    if (!isSensitive(el)) return { ok: true };
    const key = elementKey(el);
    for (const [confirmId, keys] of this.confirms) {
      if (keys.has(key) && this.accepted.has(confirmId)) return { ok: true };
    }
    return { ok: false, say: 'I need you to confirm the amount first.' };
  }

  /** Remember which elements a confirm covers. Only sensitive elements are recorded. */
  recordConfirm(confirmId: string, elements: readonly LayoutElement[]): void {
    this.confirms.set(confirmId, new Set(elements.filter(isSensitive).map(elementKey)));
  }

  /** Accept a recorded confirm. Unknown ids are ignored, so a stray reply can't create coverage. */
  accept(confirmId: string): boolean {
    if (!this.confirms.has(confirmId)) return false;
    this.accepted.add(confirmId);
    return true;
  }

  hasAccepted(el: LayoutElement): boolean {
    return this.allowGuide(el).ok && isSensitive(el);
  }

  step(fingerprint: string): StepVerdict {
    this.startMs ??= this.now();
    this.steps++;
    if (this.steps > this.maxSteps || this.now() - this.startMs > this.maxMs) return 'budget';
    const count = (this.seen.get(fingerprint) ?? 0) + 1;
    this.seen.set(fingerprint, count);
    return count >= 3 ? 'loop' : 'ok';
  }

  /** After the user agrees to go back, the loop counter for that screen starts again. */
  forgetScreen(fingerprint: string): void {
    this.seen.delete(fingerprint);
  }
}
