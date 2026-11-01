import { describe, expect, it } from 'vitest';
import { Policy } from '../src/agent/policy.ts';
import type { LayoutElement } from '@fingerpost/protocol';

function makeElement(overrides: Partial<LayoutElement> & { id: string; role: string }): LayoutElement {
  return {
    label: overrides.label ?? overrides.id,
    polygon: [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 1, v: 1 }, { u: 0, v: 1 }],
    textNorm: overrides.textNorm ?? overrides.label?.toLowerCase() ?? overrides.id,
    confidence: overrides.confidence ?? 0.95,
    ...overrides,
  } as LayoutElement;
}

describe('Policy', () => {
  describe('allowGuide', () => {
    it('allows guide to a normal button', () => {
      const p = new Policy();
      const el = makeElement({ id: 'drinks', role: 'button' });
      expect(p.allowGuide(el)).toEqual({ ok: true });
    });

    it('refuses guide to pay without accepted confirm', () => {
      const p = new Policy();
      const el = makeElement({ id: 'pay-card', role: 'pay', label: 'Pay by card' });
      const result = p.allowGuide(el);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.say).toContain('confirm');
    });

    it('allows guide to pay after confirm is accepted', () => {
      const p = new Policy();
      const el = makeElement({ id: 'pay-card', role: 'pay', label: 'Pay by card' });
      p.recordConfirm('c1', [el]);
      p.accept('c1');
      expect(p.allowGuide(el)).toEqual({ ok: true });
    });

    it('refuses guide to submit without accepted confirm', () => {
      const p = new Policy();
      const el = makeElement({ id: 'submit-btn', role: 'submit', label: 'Submit' });
      const result = p.allowGuide(el);
      expect(result.ok).toBe(false);
    });

    it('refuses guide to confirm-role without accepted confirm', () => {
      const p = new Policy();
      const el = makeElement({ id: 'confirm-btn', role: 'confirm', label: 'Confirm' });
      const result = p.allowGuide(el);
      expect(result.ok).toBe(false);
    });
  });

  describe('yes to an earlier confirm does not unlock a new pay target', () => {
    it('per-confirm-id binding', () => {
      const p = new Policy();
      const payOld = makeElement({ id: 'pay-old', role: 'pay', label: 'Pay old' });
      const payNew = makeElement({ id: 'pay-new', role: 'pay', label: 'Pay new' });

      // Confirm covers the old pay button
      p.recordConfirm('c1', [payOld]);
      p.accept('c1');
      expect(p.allowGuide(payOld)).toEqual({ ok: true });

      // New pay button on a new screen: NOT covered by c1
      const result = p.allowGuide(payNew);
      expect(result.ok).toBe(false);

      // A new confirm for the new pay button
      p.recordConfirm('c2', [payNew]);
      // Not accepted yet
      expect(p.allowGuide(payNew).ok).toBe(false);
      // Now accept
      p.accept('c2');
      expect(p.allowGuide(payNew)).toEqual({ ok: true });
    });
  });

  describe('element identity', () => {
    it('a confirm still covers the same button after the next parse renumbers its id', () => {
      const p = new Policy();
      p.recordConfirm('c1', [makeElement({ id: 'e4', role: 'pay', label: 'Pay by card' })]);
      p.accept('c1');
      expect(p.allowGuide(makeElement({ id: 'e3', role: 'pay', label: 'Pay by card' }))).toEqual({ ok: true });
    });

    it('accepting an unknown confirm id unlocks nothing', () => {
      const p = new Policy();
      expect(p.accept('never-sent')).toBe(false);
      expect(p.allowGuide(makeElement({ id: 'pay', role: 'pay', label: 'Pay' })).ok).toBe(false);
    });
  });

  describe('step budget', () => {
    it('step budget 20 ends with budget', () => {
      const p = new Policy();
      for (let i = 1; i <= 20; i++) {
        expect(p.step(`fp-${i}`)).toBe('ok');
      }
      expect(p.step('fp-21')).toBe('budget');
    });

    it('5 min timeout ends with budget', () => {
      let now = 0;
      const p = new Policy({ now: () => now });
      expect(p.step('fp-1')).toBe('ok');
      now = 5 * 60 * 1000 + 1;
      expect(p.step('fp-2')).toBe('budget');
    });
  });

  describe('loop detection', () => {
    it('same fingerprint 3 times returns loop', () => {
      const p = new Policy();
      expect(p.step('fp-same')).toBe('ok');
      expect(p.step('fp-same')).toBe('ok');
      expect(p.step('fp-same')).toBe('loop');
    });

    it('different fingerprints do not trigger loop', () => {
      const p = new Policy();
      expect(p.step('fp-a')).toBe('ok');
      expect(p.step('fp-b')).toBe('ok');
      expect(p.step('fp-c')).toBe('ok');
      expect(p.step('fp-a')).toBe('ok');
    });
  });
});

