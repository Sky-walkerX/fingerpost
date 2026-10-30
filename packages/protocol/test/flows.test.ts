import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { z } from 'zod';
import { Layout, parseClientMessage, parseServerMessage } from '@fingerpost/protocol';

const dir = new URL('../fixtures/flows/', import.meta.url);
const Flow = z.strictObject({
  name: z.string().min(1), scene: z.literal('fastfood'), seed: z.literal(1),
  steps: z.array(z.strictObject({ from: z.enum(['client', 'server']), msg: z.record(z.string(), z.unknown()),
    screen: z.enum(['home', 'menu', 'drink-size', 'pay', 'pin', 'done']).optional() })).min(1),
});
const flows = readdirSync(dir).filter((name) => name.endsWith('.json')).sort()
  .map((name) => Flow.parse(JSON.parse(readFileSync(new URL(name, dir), 'utf8'))));

test('all four frozen Day 4 flow contracts are present', () => {
  expect(flows.map((flow) => flow.name)).toEqual(['explore-summary', 'go-back', 'guide-start', 'medium-cola']);
});

test.each(flows)('$name uses only existing fp.v1 messages and supported screen markers', (flow) => {
  for (const step of flow.steps) {
    if (step.from === 'client') {
      const parsed = parseClientMessage(step.msg);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(parsed.msg).toEqual(step.msg);
    } else {
      const parsed = parseServerMessage(step.msg);
      expect(parsed.kind).toBe('ok');
      if (parsed.kind === 'ok') expect(parsed.msg).toEqual(step.msg);
    }
  }
});

test('critical targets follow an accepted reply to the current confirmation', () => {
  for (const flow of flows) {
    let layout: z.infer<typeof Layout> | undefined;
    let confirmId: unknown, accepted = false;
    for (const { from, msg } of flow.steps) {
      if (from === 'server' && msg.type === 'layout') layout = Layout.parse(msg);
      if (from === 'server' && msg.type === 'confirm') { confirmId = msg.id; accepted = false; }
      if (from === 'client' && msg.type === 'confirm.reply') accepted = msg.re === confirmId && msg.accepted === true;
      if (from === 'server' && msg.type === 'target') {
        const element = layout?.elements.find((element) => element.id === msg.elementId);
        expect(element).toBeDefined();
        if (element && ['pay', 'confirm', 'submit'].includes(element.role)) expect(accepted).toBe(true);
      }
    }
  }
});

test('medium-cola reaches local PIN entry without uploading a PIN image or subsequent audio', () => {
  const flow = flows.find((flow) => flow.name === 'medium-cola')!;
  const entry = flow.steps.findIndex(({ from, msg }) => from === 'client' && msg.type === 'event' && msg.kind === 'pinModeEntered');
  expect(entry).toBeGreaterThan(0);
  expect(flow.steps.some(({ from, msg, screen }) => from === 'client' && msg.type === 'keyframe' && screen === 'pin')).toBe(false);
  expect(flow.steps.slice(entry).some(({ from, msg }) => from === 'client' && ['audio', 'keyframe'].includes(String(msg.type)))).toBe(false);
  expect(flow.steps.at(-1)?.msg).toMatchObject({ type: 'finish', result: 'done' });
});

test('go-back requests fresh menu context and targets drinks again', () => {
  const flow = flows.find((flow) => flow.name === 'go-back')!;
  const changed = flow.steps.findIndex(({ msg }) => msg.type === 'event' && msg.kind === 'screenChanged');
  expect(changed).toBeGreaterThan(0);
  expect(flow.steps[changed + 1]).toMatchObject({ from: 'client', screen: 'menu', msg: { type: 'keyframe', purpose: 'locate' } });
  expect(flow.steps.slice(changed).find(({ msg }) => msg.type === 'target')?.msg.elementId).toBe('drinks');
});

test('explore requests exploration and a short regional summary, without a guessed target', () => {
  const flow = flows.find((flow) => flow.name === 'explore-summary')!;
  const summary = flow.steps.find(({ msg }) => msg.type === 'say')!.msg;
  expect(summary).toMatchObject({ priority: 'info' });
  expect(String(summary.text)).toMatch(/Say more for details\.$/);
  expect(flow.steps.some(({ msg }) => msg.type === 'keyframe' && msg.purpose === 'explore')).toBe(true);
  expect(flow.steps.some(({ msg }) => msg.type === 'target')).toBe(false);
});
