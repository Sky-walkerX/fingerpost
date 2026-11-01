import type { LayoutElement } from '@fingerpost/protocol';

const SENSITIVE_ROLES = new Set(['pay', 'confirm', 'submit']);

/**
 * Policy layer outside the model (design §4.3).
 * Enforces:
 *   1. guide_to on role pay|confirm|submit blocked until confirm_with_user accepted for that element/confirm id
 *   2. Step budget: 20 steps or 5 min
 *   3. Loop detection: same fingerprint 3 times → 'loop'
 */
export class Policy {
  /** Maps confirm id → set of element ids it covers. */
  private confirms = new Map<string, Set<string>>();
  /** Set of confirm ids that were accepted. */
  private accepted = new Set<string>();

  private stepCount = 0;
  private startMs: number | null = null;
  private fingerprintCounts = new Map<string, number>();

  private readonly maxSteps: number;
  private readonly maxMs: number;
  private readonly now: () => number;

  constructor(opts?: { maxSteps?: number; maxMs?: number; now?: () => number }) {
    this.maxSteps = opts?.maxSteps ?? 20;
    this.maxMs = opts?.maxMs ?? 5 * 60 * 1000;
    this.now = opts?.now ?? (() => Date.now());
  }

  /** Check whether guiding to an element is allowed. */
  allowGuide(el: LayoutElement): { ok: true } | { ok: false; say: string } {
    if (!SENSITIVE_ROLES.has(el.role)) return { ok: true };
    // Need a confirm that covers this element and was accepted
    for (const [confirmId, elementIds] of this.confirms) {
      if (elementIds.has(el.id) && this.accepted.has(confirmId)) {
        return { ok: true };
      }
    }
    return { ok: false, say: 'I need you to confirm the amount first.' };
  }

  /** Record a confirm_with_user call and the element ids it covers. */
  recordConfirm(confirmId: string, elementIds: string[]): void {
    this.confirms.set(confirmId, new Set(elementIds));
  }

  /** Record that a confirm was accepted. */
  accept(confirmId: string): void {
    this.accepted.add(confirmId);
  }

  /** Advance one step and check budget/loop. */
  step(fingerprint: string): 'ok' | 'budget' | 'loop' {
    if (this.startMs === null) this.startMs = this.now();
    this.stepCount++;
    if (this.stepCount > this.maxSteps) return 'budget';
    if (this.now() - this.startMs > this.maxMs) return 'budget';

    const count = (this.fingerprintCounts.get(fingerprint) ?? 0) + 1;
    this.fingerprintCounts.set(fingerprint, count);
    if (count >= 3) return 'loop';

    return 'ok';
  }
}

