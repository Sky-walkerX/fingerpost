import { describe, expect, it } from 'vitest';
import { ExpectedTotal, parseMoney } from '../src/agent/overcharge.ts';

describe('session-only overcharge guard', () => {
  it('normalizes currency, numerals and minor units without rounding mismatches', () => {
    expect(parseMoney('₹149.00')).toEqual({minor:14900,currency:'INR'});
    expect(parseMoney('मुझे १४९ रुपये की उम्मीद है')).toEqual({minor:14900,currency:'INR'});
    expect(parseMoney('Espero 149 euros')).toEqual({minor:14900,currency:'EUR'});
    expect(parseMoney('I expect 149 rupees')).toEqual({minor:14900,currency:'INR'});
  });
  it('sums chosen prices, honors explicit expectation, compares currency, resets', () => {
    const total=new ExpectedTotal();
    total.selected('Small ₹99');total.selected('Drink ₹50');
    expect(total.compare({value:149,currency:'INR'})).toBeNull();
    expect(total.compare({value:1490,currency:'INR'})).toEqual({expected:{minor:14900,currency:'INR'},shown:{minor:149000,currency:'INR'}});
    expect(total.compare({value:149,currency:'USD'})).not.toBeNull();
    total.expect('I expect 200 rupees');
    expect(total.compare({value:200,currency:'INR'})).toBeNull();
    total.clear();expect(total.compare({value:1490,currency:'INR'})).toBeNull();
  });
  it('does not compare ambiguous prices or invent a mixed-currency sum', () => {
    expect(parseMoney('₹99 or ₹149')).toBeNull();
    const total=new ExpectedTotal();total.selected('₹99');total.selected('$2');
    expect(total.compare({value:101,currency:'INR'})).toBeNull();
  });
});

import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import type { Layout } from '@fingerpost/protocol';
import { AgentSession } from '../src/agent/loop.ts';
import { rulesPlanner } from '../src/agent/planner.ts';

it('warns before the confirm, keeps payment locked, and emits no console amounts', async () => {
  const fixture = JSON.parse(readFileSync(new URL('../../../packages/protocol/fixtures/flows/medium-cola.json',import.meta.url),'utf8')) as {steps:{screen?:string;msg:Layout}[]};
  const screen=(name:string)=>structuredClone(fixture.steps.find(s=>s.screen===name&&s.msg.type==='layout')!.msg);
  const spies=[vi.spyOn(console,'log'),vi.spyOn(console,'warn'),vi.spyOn(console,'error')];
  try {
    for(const tampered of [false,true]) {
      const agent=new AgentSession('Order a medium cola and pay',{planner:rulesPlanner()});
      const sizes=screen('drink-size');
      agent.pressed(sizes.elements.find(e=>e.id==='medium')!,sizes);
      const pay=screen('pay');
      if(tampered) pay.elements.find(e=>e.role==='text'&&e.label.includes('149'))!.label='Total ₹1,490';
      const turn=await agent.decide(pay);
      expect(turn.action.kind).toBe('confirm');
      if(turn.action.kind!=='confirm') throw new Error('expected confirm');
      expect(turn.action.summary.startsWith('Warning:')).toBe(tampered);
      expect(agent.allowsGuide(pay.elements.find(e=>e.role==='pay')!)).toBe(false);
    }
    expect(spies.flatMap(s=>s.mock.calls)).toEqual([]);
  } finally { spies.forEach(s=>s.mockRestore()); }
});
