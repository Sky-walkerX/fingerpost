import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Layout, LayoutElement, ServerMessage } from '@fingerpost/protocol';
import { AgentSession, type ToolCall, type ToolImpl } from '../src/agent/loop.ts';
import { Policy } from '../src/agent/policy.ts';
import type { ModelPort } from '../src/models/port.ts';
import { inferIntent } from '../src/agent/intent.ts';
import { layoutFingerprint } from '../src/session/pipeline.ts';

// ── helpers ──────────────────────────────────────────────────────────────

interface FlowStep {
  from: 'client' | 'server';
  msg: Record<string, unknown>;
  screen?: string;
}

interface Flow {
  name: string;
  scene: string;
  seed: number;
  steps: FlowStep[];
}

function loadFlow(name: string): Flow {
  const path = join(import.meta.dirname, '../../packages/protocol/fixtures/flows', `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as Flow;
}

/** Extract layouts from a flow indexed by screen name. */
function flowLayouts(flow: Flow): Map<string, Layout> {
  const layouts = new Map<string, Layout>();
  for (const step of flow.steps) {
    if (step.from === 'server' && step.msg.type === 'layout' && step.screen) {
      layouts.set(step.screen, step.msg as unknown as Layout);
    }
  }
  return layouts;
}

/** Stub ModelPort that never gets called (the agent uses ToolImpl instead). */
function stubModels(): ModelPort {
  return {
    parseScreen: () => { throw new Error('unexpected parseScreen'); },
    segmentByBox: () => { throw new Error('unexpected segmentByBox'); },
    segmentByText: () => { throw new Error('unexpected segmentByText'); },
  };
}

function makeLayout(elements: LayoutElement[], fingerprint?: string): Layout {
  const fp = fingerprint ?? layoutFingerprint(elements);
  return {
    id: 'layout-' + Math.random().toString(36).slice(2),
    ts: 0,
    type: 'layout',
    fingerprint: fp,
    screenType: 'menu',
    rotation: 0,
    language: 'en',
    sensitivity: 'none',
    elements,
    source: 'model',
  } as Layout;
}

function makeElement(overrides: Partial<LayoutElement> & { id: string; role: string }): LayoutElement {
  return {
    label: overrides.label ?? overrides.id,
    polygon: [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 1, v: 1 }, { u: 0, v: 1 }],
    textNorm: overrides.textNorm ?? overrides.label?.toLowerCase() ?? overrides.id,
    confidence: overrides.confidence ?? 0.95,
    ...overrides,
  } as LayoutElement;
}

// ── tests ────────────────────────────────────────────────────────────────

describe('agent loop', () => {
  it('completes medium-cola flow', async () => {
    const flow = loadFlow('medium-cola');
    const layouts = flowLayouts(flow);
    const sent: ServerMessage[] = [];

    // Script the model's tool calls for each screen:
    // home → guide_to start-order
    // menu → guide_to drinks
    // drink-size → guide_to medium
    // pay → confirm_with_user then guide_to pay-card
    // after pay verify → finish done
    const toolCallSequence: ToolCall[][] = [
      // After home layout
      [{ id: 'tc1', name: 'guide_to', arguments: { element_id: 'start-order', why: 'Start the order' } }],
      // After menu layout (verify ok)
      [{ id: 'tc2', name: 'guide_to', arguments: { element_id: 'drinks', why: 'Select drinks' } }],
      // After drink-size layout (verify ok)
      [{ id: 'tc3', name: 'guide_to', arguments: { element_id: 'medium', why: 'Select medium' } }],
      // After pay layout (verify ok) - first confirm, then guide
      [{ id: 'tc4', name: 'confirm_with_user', arguments: {
        summary: 'Medium cola, Total ₹149',
        amount_value: 149,
        amount_currency: 'INR',
        element_ids: ['pay-card'],
      } }],
      // After confirm accepted
      [{ id: 'tc5', name: 'guide_to', arguments: { element_id: 'pay-card', why: 'Pay by card' } }],
      // After pay verified
      [{ id: 'tc6', name: 'finish', arguments: { result: 'done', reason: 'PIN entry is ready.' } }],
    ];
    let callIndex = 0;

    const tools: ToolImpl = {
      async chat() {
        const calls = toolCallSequence[callIndex] ?? [];
        callIndex++;
        return { toolCalls: calls };
      },
    };

    const agent = new AgentSession({
      models: stubModels(),
      send: (m) => sent.push(m),
      now: () => 0,
      tools,
    });

    agent.onGoal('Order a medium cola and pay');

    // Feed the home layout
    const homeLayout = layouts.get('home')!;
    await agent.onLayout(homeLayout);
    // Agent should have sent target for start-order
    const target1 = sent.find((m) => m.type === 'target' && (m as any).elementId === 'start-order');
    expect(target1).toBeDefined();

    // Simulate verify ok → menu layout
    await agent.onVerify('ok');
    const menuLayout = layouts.get('menu')!;
    await agent.onLayout(menuLayout);
    // Agent should have sent target for drinks
    const target2 = sent.find((m) => m.type === 'target' && (m as any).elementId === 'drinks');
    expect(target2).toBeDefined();

    // Verify ok → drink-size layout
    await agent.onVerify('ok');
    const sizeLayout = layouts.get('drink-size')!;
    await agent.onLayout(sizeLayout);
    const target3 = sent.find((m) => m.type === 'target' && (m as any).elementId === 'medium');
    expect(target3).toBeDefined();

    // Verify ok → pay layout
    await agent.onVerify('ok');
    const payLayout = layouts.get('pay')!;
    await agent.onLayout(payLayout);
    // Agent should have sent confirm
    const confirmMsg = sent.find((m) => m.type === 'confirm');
    expect(confirmMsg).toBeDefined();
    expect((confirmMsg as any).summary).toContain('149');

    // Accept confirm
    await agent.onConfirmReply((confirmMsg as any).id, true);

    // Now the model calls guide_to pay-card (triggered by next loop)
    await agent.onLayout(payLayout);
    const target4 = sent.find((m) => m.type === 'target' && (m as any).elementId === 'pay-card');
    expect(target4).toBeDefined();

    // Verify ok → finish
    await agent.onVerify('ok');
    // Feed a final layout to trigger finish tool call
    await agent.onLayout(payLayout);
    const finish = sent.find((m) => m.type === 'finish');
    expect(finish).toBeDefined();
    expect((finish as any).result).toBe('done');
  });

  it('guide_to pay without confirm is refused and the model is told why', async () => {
    const sent: ServerMessage[] = [];

    const tools: ToolImpl = {
      async chat() {
        return {
          toolCalls: [
            { id: 'tc1', name: 'guide_to', arguments: { element_id: 'pay-card', why: 'Pay now' } },
          ],
        };
      },
    };

    const payEl = makeElement({ id: 'pay-card', role: 'pay', label: 'Pay by card' });
    const layout = makeLayout([payEl]);

    const agent = new AgentSession({
      models: stubModels(),
      send: (m) => sent.push(m),
      now: () => 0,
      tools,
    });

    agent.onGoal('Pay now');
    await agent.onLayout(layout);

    // Should NOT have sent a target for pay-card
    const target = sent.find((m) => m.type === 'target');
    expect(target).toBeUndefined();

    // Should have sent a safety say about needing to confirm first
    const say = sent.find((m) => m.type === 'say' && (m as any).priority === 'safety');
    expect(say).toBeDefined();
    expect((say as any).text).toContain('confirm');
  });

  it('yes to an earlier confirm does not unlock a new pay target', async () => {
    const sent: ServerMessage[] = [];
    let callCount = 0;

    const tools: ToolImpl = {
      async chat() {
        callCount++;
        if (callCount === 1) {
          // Confirm for old pay button
          return {
            toolCalls: [
              { id: 'tc1', name: 'confirm_with_user', arguments: {
                summary: 'Old payment, Total ₹100',
                amount_value: 100,
                amount_currency: 'INR',
                element_ids: ['pay-old'],
              } },
            ],
          };
        }
        if (callCount === 2) {
          // Try to guide to a NEW pay button not covered by the confirm
          return {
            toolCalls: [
              { id: 'tc2', name: 'guide_to', arguments: { element_id: 'pay-new', why: 'Pay new amount' } },
            ],
          };
        }
        return { toolCalls: [] };
      },
    };

    const payOld = makeElement({ id: 'pay-old', role: 'pay', label: 'Pay old' });
    const payNew = makeElement({ id: 'pay-new', role: 'pay', label: 'Pay new' });
    const layout1 = makeLayout([payOld]);
    const layout2 = makeLayout([payNew], 'sh64:different');

    const agent = new AgentSession({
      models: stubModels(),
      send: (m) => sent.push(m),
      now: () => 0,
      tools,
    });

    agent.onGoal('Buy something');
    await agent.onLayout(layout1);

    // Confirm sent for old pay
    const confirmMsg = sent.find((m) => m.type === 'confirm');
    expect(confirmMsg).toBeDefined();

    // Accept confirm
    await agent.onConfirmReply((confirmMsg as any).id, true);

    // New screen with new pay button
    await agent.onLayout(layout2);

    // Should NOT have a target for pay-new (the old confirm doesn't cover it)
    const target = sent.find((m) => m.type === 'target' && (m as any).elementId === 'pay-new');
    expect(target).toBeUndefined();

    // Should have a safety say
    const safety = sent.filter((m) => m.type === 'say' && (m as any).priority === 'safety');
    expect(safety.length).toBeGreaterThan(0);
  });

  it('step budget 20 ends with finish{failed} and a spoken reason', async () => {
    const sent: ServerMessage[] = [];
    let callCount = 0;

    const tools: ToolImpl = {
      async chat() {
        callCount++;
        // Always say something (a step)
        return {
          toolCalls: [
            { id: `tc${callCount}`, name: 'say', arguments: { text: `Step ${callCount}` } },
          ],
        };
      },
    };

    const el = makeElement({ id: 'btn', role: 'button', label: 'Button' });

    const agent = new AgentSession({
      models: stubModels(),
      send: (m) => sent.push(m),
      now: () => 0,
      tools,
    });

    agent.onGoal('Do a lot of things');

    // Feed 21 layouts, each with a unique fingerprint
    for (let i = 0; i < 21; i++) {
      const layout = makeLayout([el], `sh64:fp${i.toString().padStart(4, '0')}`);
      if (!agent.checkPolicy()) break;
      await agent.onLayout(layout);
    }

    const finish = sent.find((m) => m.type === 'finish');
    expect(finish).toBeDefined();
    expect((finish as any).result).toBe('failed');
    expect((finish as any).say).toBeTruthy();
  });

  it('same fingerprint 3 times asks to go back', async () => {
    const sent: ServerMessage[] = [];
    let callCount = 0;

    const tools: ToolImpl = {
      async chat() {
        callCount++;
        return {
          toolCalls: [
            { id: `tc${callCount}`, name: 'say', arguments: { text: 'Trying again' } },
          ],
        };
      },
    };

    const el = makeElement({ id: 'btn', role: 'button', label: 'Button' });

    const agent = new AgentSession({
      models: stubModels(),
      send: (m) => sent.push(m),
      now: () => 0,
      tools,
    });

    agent.onGoal('Do something');

    const layout = makeLayout([el], 'sh64:samescreen1234');

    // Feed same layout 3 times
    agent.checkPolicy(); // does nothing first time (no fingerprint yet)
    await agent.onLayout(layout);

    agent.checkPolicy(); // 2nd
    await agent.onLayout(layout);

    const policyResult = agent.checkPolicy(); // 3rd
    // The policy check in the test itself should detect loop

    // After 3 times, the ask should appear
    const ask = sent.find((m) => m.type === 'ask' && (m as any).question === 'Should I go back?');
    expect(ask).toBeDefined();
  });

  it('recovers when the screen goes back', async () => {
    const flow = loadFlow('go-back');
    const layouts = flowLayouts(flow);
    const sent: ServerMessage[] = [];
    let callCount = 0;

    const tools: ToolImpl = {
      async chat() {
        callCount++;
        if (callCount === 1) {
          return { toolCalls: [{ id: 'tc1', name: 'guide_to', arguments: { element_id: 'start-order', why: 'Start' } }] };
        }
        if (callCount === 2) {
          return { toolCalls: [{ id: 'tc2', name: 'guide_to', arguments: { element_id: 'drinks', why: 'Drinks' } }] };
        }
        // After back, re-plan: guide to drinks again
        if (callCount === 3) {
          return { toolCalls: [{ id: 'tc3', name: 'guide_to', arguments: { element_id: 'drinks', why: 'Re-select drinks after back' } }] };
        }
        return { toolCalls: [{ id: 'tc4', name: 'finish', arguments: { result: 'done', reason: 'Done.' } }] };
      },
    };

    const agent = new AgentSession({
      models: stubModels(),
      send: (m) => sent.push(m),
      now: () => 0,
      tools,
    });

    agent.onGoal('Order a medium cola');

    // Home layout → target start-order
    await agent.onLayout(layouts.get('home')!);
    expect(sent.some((m) => m.type === 'target' && (m as any).elementId === 'start-order')).toBe(true);

    // Verify ok → menu layout
    await agent.onVerify('ok');
    await agent.onLayout(layouts.get('menu')!);
    expect(sent.some((m) => m.type === 'target' && (m as any).elementId === 'drinks')).toBe(true);

    // Verify ok → drink-size
    await agent.onVerify('ok');

    // But user goes back! We get the menu layout again.
    await agent.onLayout(layouts.get('menu')!);

    // Agent should re-plan and target drinks again
    const drinksTargets = sent.filter((m) => m.type === 'target' && (m as any).elementId === 'drinks');
    expect(drinksTargets.length).toBeGreaterThanOrEqual(2);
  });

  it('guide intent keeps the Day 2 single-target path', () => {
    // inferIntent should return 'guide' for simple single-target goals
    expect(inferIntent('Press start order', 'auto')).toBe('guide');
    expect(inferIntent('Press start', 'guide')).toBe('guide');
    expect(inferIntent('Tap the power button', 'auto')).toBe('guide');

    // And 'task' for multi-step goals
    expect(inferIntent('Order a medium cola and pay', 'auto')).toBe('task');
    expect(inferIntent('Buy a ticket', 'auto')).toBe('task');

    // And 'explore' for explore goals
    expect(inferIntent('What is on this screen?', 'auto')).toBe('explore');
    expect(inferIntent('Read the screen', 'auto')).toBe('explore');
  });
});

