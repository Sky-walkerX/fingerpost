import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { encodeFrame, ServerMessage, type LayoutElement } from '@fingerpost/protocol';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { mockModels } from '../src/models/mock/mock-models.ts';
import type { ParsedLayout } from '../src/parse/spark-parse.ts';

/**
 * Contract replay (Days 4–7 plan, "Contracts"): the client half of each shared flow script drives a real
 * gateway socket in mock mode, and the server half must come back in the same order. Mock Spark returns the
 * layout the script records for the screen in view; ids, timestamps, say text and SAM-refined polygons are
 * not compared, but every decision the agent makes is.
 */
interface Step { from: 'client' | 'server'; msg: Record<string, unknown>; screen?: string }
interface Flow { name: string; steps: Step[] }
const load = (name: string): Flow => JSON.parse(readFileSync(new URL(`../../../packages/protocol/fixtures/flows/${name}.json`, import.meta.url), 'utf8'));

let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

/** Fields that carry decisions; everything else (ids, ts, wording, refined polygons) may differ. */
const DECISION_FIELDS: Record<string, string[]> = {
  'goal.ack': ['intent'], layout: ['fingerprint', 'screenType'], target: ['elementId'], verify: ['re', 'result'],
  confirm: ['amount'], ask: [], finish: ['result', 'say'], 'sim.touch': ['elementId'], ready: [],
};

async function replay(flow: Flow) {
  const layouts = new Map<string, ParsedLayout>();
  for (const step of flow.steps) {
    if (step.from === 'server' && step.msg.type === 'layout' && step.screen && !layouts.has(step.screen)) {
      const m = step.msg as { screenType: ParsedLayout['screenType']; sensitivity: ParsedLayout['sensitivity']; language: string; rotation: ParsedLayout['rotation']; elements: LayoutElement[] };
      layouts.set(step.screen, { screenType: m.screenType, sensitivity: m.sensitivity, language: m.language, rotation: m.rotation, elements: m.elements });
    }
  }
  let screen = '';
  const models = mockModels();
  models.parseScreen = async () => ({ layout: layouts.get(screen)!, usage: { inputTokens: 0, outputTokens: 0 }, latencyMs: 0, promptId: 'flow' });
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }), { models });
  await app.ready();
  const ws = await app.injectWS('/v1/session');
  const received: ServerMessage[] = [];
  ws.on('message', (data: Buffer) => received.push(ServerMessage.parse(JSON.parse(data.toString()))));

  const ignored = new Set(['say', 'transcript']);
  const ids = new Map<string, string>(); // script correlation id → id the gateway actually generated
  let consumed = 0, seq = 0;
  for (const step of flow.steps) {
    if (step.from === 'client') {
      const msg: Record<string, unknown> = { ...step.msg, id: step.msg.id === '*' ? `c${seq++}` : step.msg.id };
      if (typeof msg.re === 'string') msg.re = ids.get(msg.re) ?? msg.re;
      if (msg.type === 'keyframe') {
        screen = step.screen!;
        ws.send(encodeFrame(msg, new Uint8Array([0xff, 0xd8, 0xff, 0xd9])));
      } else ws.send(JSON.stringify(msg));
      continue;
    }
    const want = step.msg;
    if (want.type === 'sim.touch') {
      const { runId, screenId, x, y, u, v, elementId } = want as Record<string, unknown>;
      await app.inject({ method: 'POST', url: '/v1/sim/events', payload: { runId, screenId, x, y, u, v, elementId, ts: 1 } });
    }
    let got: ServerMessage | undefined;
    await vi.waitFor(() => {
      const next = received.slice(consumed).findIndex((m) => !ignored.has(m.type));
      expect(next).toBeGreaterThanOrEqual(0);
      consumed += next;
      got = received[consumed];
    });
    consumed++;
    expect(got!.type, `${flow.name}: message after ${consumed - 1}`).toBe(want.type);
    for (const field of DECISION_FIELDS[want.type as string] ?? []) {
      expect((got as Record<string, unknown>)[field], `${flow.name}: ${want.type}.${field}`).toEqual(want[field]);
    }
    if (want.id !== '*' && typeof want.id === 'string') ids.set(want.id, got!.id);
  }
  await new Promise((r) => setTimeout(r, 20));
  expect(received.slice(consumed).filter((m) => !ignored.has(m.type)).map((m) => m.type), `${flow.name}: unexpected extra messages`).toEqual([]);
  ws.terminate();
}

test('medium-cola: task flow with amount confirm, pay target and PIN hand-off', async () => {
  await replay(load('medium-cola'));
});

test('go-back: an external Back press re-plans from the menu', async () => {
  await replay(load('go-back'));
});

test('guide-start: guide intent keeps the single-target path', async () => {
  await replay(load('guide-start'));
});
