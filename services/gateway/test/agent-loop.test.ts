import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Layout, LayoutElement } from '@fingerpost/protocol';
import { AgentSession, parseYesNo, type AgentTurn } from '../src/agent/loop.ts';
import { rulesPlanner, screenAmount, type AgentState, type Planner, type ToolCall } from '../src/agent/planner.ts';
import { inferIntent } from '../src/agent/intent.ts';
import { layoutFingerprint } from '../src/session/pipeline.ts';

// Screens from the shared seed-1 fast-food flow (packages/protocol/fixtures/flows/medium-cola.json).
const flow = JSON.parse(readFileSync(new URL('../../../packages/protocol/fixtures/flows/medium-cola.json', import.meta.url), 'utf8')) as {
  steps: { from: string; msg: Record<string, unknown>; screen?: string }[];
};
const screens = new Map<string, Layout>();
for (const s of flow.steps) if (s.from === 'server' && s.msg.type === 'layout' && s.screen && !screens.has(s.screen)) screens.set(s.screen, s.msg as unknown as Layout);
const screen = (name: string) => screens.get(name)!;

const el = (id: string, label: string, role: LayoutElement['role']): LayoutElement => ({
  id, label, role, confidence: 0.95, textNorm: label.toLowerCase(),
  polygon: [{ u: 0.1, v: 0.1 }, { u: 0.3, v: 0.1 }, { u: 0.3, v: 0.2 }, { u: 0.1, v: 0.2 }],
});
const layout = (elements: LayoutElement[], screenType: Layout['screenType'] = 'menu'): Layout => ({
  id: 'l', ts: 0, type: 'layout', fingerprint: layoutFingerprint(elements), screenType, rotation: 0, language: 'en',
  sensitivity: 'none', elements, source: 'model',
});

/** A planner that returns scripted tool calls in order and records what it was shown. */
function scripted(...calls: ToolCall[]): Planner & { seen: AgentState[] } {
  const seen: AgentState[] = [];
  return { id: 'scripted', seen, async next(state) { seen.push(state); const call = calls.shift(); if (!call) throw new Error('script ran out'); return { call }; } };
}
const call = (name: string, args: Record<string, unknown> = {}): ToolCall => ({ name, arguments: args });
const action = (t: AgentTurn) => t.action;

describe('agent loop', () => {
  it('completes medium-cola flow', async () => {
    const agent = new AgentSession('Order a medium cola and pay', { planner: rulesPlanner() });
    expect(action(await agent.decide(screen('home')))).toMatchObject({ kind: 'target', element: { id: 'start-order' } });
    agent.pressed(screen('home').elements.find((e) => e.id === 'start-order')!, screen('menu'));
    expect(action(await agent.decide(screen('menu')))).toMatchObject({ kind: 'target', element: { id: 'drinks' } });
    expect(action(await agent.decide(screen('drink-size')))).toMatchObject({ kind: 'target', element: { id: 'medium' } });
    const confirm = action(await agent.decide(screen('pay')));
    expect(confirm).toMatchObject({ kind: 'confirm', amount: { value: 149, currency: 'INR' } });
    if (confirm.kind !== 'confirm') throw new Error('expected confirm');
    expect(confirm.summary).toContain('149');
    expect(agent.onConfirmReply(confirm.id, true)).toBe('accepted');
    const pay = action(await agent.decide(screen('pay')));
    expect(pay).toMatchObject({ kind: 'target', element: { id: 'pay-card', role: 'pay' } });
    if (pay.kind !== 'target') throw new Error('expected target');
    agent.pressed(pay.element, screen('pay'));
    // The pay panel is still showing: wait for the device's PIN mode instead of re-planning.
    expect(action(await agent.decide(screen('pay')))).toEqual({ kind: 'wait' });
    expect(agent.pinEntered()).toBe(true);
    expect(agent.done).toBe(true);
  });

  it('guide_to pay without confirm is refused and the model is told why', async () => {
    const planner = scripted(call('guide_to', { element_id: 'pay-card', why: 'pay' }), call('confirm_with_user', {
      summary: 'Medium cola', amount_value: 1, amount_currency: 'USD', element_ids: ['pay-card'] }));
    const agent = new AgentSession('Order a medium cola and pay', { planner });
    const turn = await agent.decide(screen('pay'));
    expect(planner.seen[1]!.feedback).toMatch(/refused.*confirm_with_user/);
    // Never a target on the pay button; the confirm carries the amount the screen shows, not the model's.
    expect(turn.action).toMatchObject({ kind: 'confirm', amount: { value: 149, currency: 'INR' } });
    if (turn.action.kind === 'confirm') expect(turn.action.summary).toContain('₹149');
  });

  it('yes to an earlier confirm does not unlock a new pay target', async () => {
    const first = layout([el('t1', 'Total ₹99', 'text'), el('p1', 'Pay now', 'pay')], 'payment_entry');
    const second = layout([el('t2', 'Total ₹999', 'text'), el('p2', 'Pay by card', 'pay')], 'payment_entry');
    const planner = scripted(
      call('confirm_with_user', { summary: 'Order', amount_value: 99, amount_currency: 'INR', element_ids: ['p1'] }),
      call('guide_to', { element_id: 'p2', why: 'pay' }), call('guide_to', { element_id: 'p2', why: 'pay' }));
    const agent = new AgentSession('buy a ticket and pay', { planner, fallback: scripted(call('finish', { result: 'failed', reason: 'stop' })) });
    const c = action(await agent.decide(first));
    if (c.kind !== 'confirm') throw new Error('expected confirm');
    expect(agent.onConfirmReply(c.id, true)).toBe('accepted');
    // A reply to a stale or unknown confirm id is ignored.
    expect(agent.onConfirmReply(c.id, true)).toBe('ignored');
    const next = action(await agent.decide(second));
    expect(next.kind).not.toBe('target');
  });

  it('step budget 20 ends with finish{failed} and a spoken reason', async () => {
    const planner: Planner = { id: 'p', async next(s) { return { call: call('guide_to', { element_id: s.screen.elements[0]!.id, why: 'x' }) }; } };
    const agent = new AgentSession('order things', { planner });
    for (let i = 0; i < 20; i++) expect(action(await agent.decide(layout([el(`b${i}`, `Button ${i}`, 'button')]))).kind).toBe('target');
    const last = action(await agent.decide(layout([el('b20', 'Button 20', 'button')])));
    expect(last).toMatchObject({ kind: 'finish', result: 'failed' });
    if (last.kind === 'finish') expect(last.say.length).toBeGreaterThan(10);
  });

  it('same fingerprint 3 times asks to go back', async () => {
    const menu = layout([el('drinks', 'Drinks', 'button'), el('back', 'Back', 'back')]);
    const agent = new AgentSession('order a cola', { planner: rulesPlanner() });
    expect(action(await agent.decide(menu)).kind).toBe('target');
    expect(action(await agent.decide(menu)).kind).toBe('target');
    const ask = action(await agent.decide(menu));
    expect(ask).toMatchObject({ kind: 'ask', question: expect.stringMatching(/go back/), options: ['Yes', 'No'] });
    if (ask.kind !== 'ask') throw new Error('expected ask');
    expect(agent.onTranscript('yes')).toBe('answered');
    expect(action(await agent.decide(menu))).toMatchObject({ kind: 'target', element: { id: 'back' } });
  });

  it('recovers when the screen goes back', async () => {
    const agent = new AgentSession('Order a medium cola', { planner: rulesPlanner() });
    await agent.decide(screen('home'));
    await agent.decide(screen('menu'));
    expect(action(await agent.decide(screen('drink-size')))).toMatchObject({ element: { id: 'medium' } });
    // The kiosk went back to the menu instead: re-plan from the new screen, not the stale "medium" step.
    expect(action(await agent.decide(screen('menu')))).toMatchObject({ kind: 'target', element: { id: 'drinks' } });
  });

  it('guide intent keeps the Day 2 single-target path', () => {
    expect(inferIntent('Press start order', 'auto')).toBe('guide');
    expect(inferIntent('press Start', 'auto')).toBe('guide');
    expect(inferIntent('Order a medium cola and pay', 'auto')).toBe('task');
    expect(inferIntent('anything', 'guide')).toBe('guide');
  });
});

describe('agent loop safety details', () => {
  it('asks which one when the goal names no option, and uses the answer', async () => {
    const agent = new AgentSession('order a cola and pay', { planner: rulesPlanner() });
    const ask = action(await agent.decide(screen('drink-size')));
    expect(ask).toMatchObject({ kind: 'ask', options: ['Small ₹99', 'Medium ₹149', 'Large ₹179'] });
    if (ask.kind !== 'ask') throw new Error('expected ask');
    expect(agent.onAnswer('wrong-id', 'medium')).toBe(false);
    expect(agent.onTranscript('medium')).toBe('answered');
    // The phone also sends answer{re} for the same reply: a duplicate, not a new goal.
    expect(agent.onAnswer(ask.id, 'medium')).toBe(true);
    expect(action(await agent.decide(screen('drink-size')))).toMatchObject({ kind: 'target', element: { id: 'medium' } });
  });

  it('a spoken no, or an unclear reply, never accepts payment', async () => {
    for (const reply of ['no', 'maybe later', 'how much is it']) {
      const agent = new AgentSession('Order a medium cola and pay', { planner: rulesPlanner() });
      expect(action(await agent.decide(screen('pay'))).kind).toBe('confirm');
      expect(agent.onTranscript(reply)).toBe('declined');
      expect(agent.done).toBe(true);
      expect(action(await agent.decide(screen('pay')))).toEqual({ kind: 'wait' });
    }
  });

  it('a failing model falls back to the rules planner for that step', async () => {
    const errors: string[] = [];
    const broken: Planner = { id: 'spark', async next() { throw new Error('timeout'); } };
    const agent = new AgentSession('Order a medium cola and pay', { planner: broken, onPlannerError: (id) => errors.push(id) });
    expect(action(await agent.decide(screen('home')))).toMatchObject({ kind: 'target', element: { id: 'start-order' } });
    expect(errors).toEqual(['spark']);
  });

  it('PIN mode only closes a task after a confirmed payment press', async () => {
    const agent = new AgentSession('Order a medium cola and pay', { planner: rulesPlanner() });
    await agent.decide(screen('home'));
    expect(agent.pinEntered()).toBe(false);
  });

  it('reads yes and no in English, Hindi and Spanish', () => {
    for (const yes of ['yes', 'Yes.', 'haan', 'हाँ', 'sí', 'okay']) expect(parseYesNo(yes)).toBe(true);
    for (const no of ['no', 'nahin', 'नहीं', 'cancel']) expect(parseYesNo(no)).toBe(false);
    for (const unclear of ['', 'what', 'how much', 'yesterday']) expect(parseYesNo(unclear)).toBeNull();
  });

  it('reads the total from the screen, and refuses to guess between two unlabeled amounts', () => {
    expect(screenAmount(screen('pay').elements)).toEqual({ label: 'Total ₹149', value: 149, currency: 'INR' });
    expect(screenAmount([el('a', '₹10', 'text'), el('b', '₹20', 'text')])).toBeNull();
    expect(screenAmount([el('a', 'Amount: Rs. 1,250', 'text')])).toMatchObject({ value: 1250, currency: 'INR' });
  });
});
