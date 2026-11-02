import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, test } from 'vitest';
import type { LayoutElement } from '@fingerpost/protocol';
import { buildApp, loadConfig, mockModels, type ParsedLayout } from '@fingerpost/gateway/eval-api';
import { runFlow, type Flow } from '../src/flow-runner.ts';

type GatewayApp = Awaited<ReturnType<typeof buildApp>>;

const flowsDir = new URL('../../packages/protocol/fixtures/flows/', import.meta.url);
const loadFlow = (name: string): Flow =>
  JSON.parse(readFileSync(new URL(`${name}.json`, flowsDir), 'utf8'));

let app: GatewayApp | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function startGateway(flow: Flow) {
  const layouts = new Map<string, ParsedLayout>();
  for (const step of flow.steps) {
    if (step.from === 'server' && step.msg.type === 'layout' && step.screen && !layouts.has(step.screen)) {
      const m = step.msg as {
        screenType: ParsedLayout['screenType'];
        sensitivity: ParsedLayout['sensitivity'];
        language: string;
        rotation: ParsedLayout['rotation'];
        elements: LayoutElement[];
      };
      layouts.set(step.screen, {
        screenType: m.screenType,
        sensitivity: m.sensitivity,
        language: m.language,
        rotation: m.rotation,
        elements: m.elements,
      });
    }
  }

  let currentScreen = '';
  const models = mockModels();
  models.parseScreen = async () => ({
    layout: layouts.get(currentScreen)!,
    usage: { inputTokens: 0, outputTokens: 0 },
    latencyMs: 0,
    promptId: 'flow',
  });

  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }), { models, glimmer: models });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address() as AddressInfo;
  return {
    gatewayUrl: `http://127.0.0.1:${addr.port}`,
    simRender: (screen: string) => {
      currentScreen = screen;
      return new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    },
  };
}

test('medium-cola flow completes with ok: true', async () => {
  const flow = loadFlow('medium-cola');
  const { gatewayUrl, simRender } = await startGateway(flow);
  const result = await runFlow(flow, { gatewayUrl, simRender });
  expect(result.ok).toBe(true);
  expect(result.steps).toBe(flow.steps.length);
  expect(result.firstDivergence).toBeUndefined();
});

test('go-back flow completes with ok: true', async () => {
  const flow = loadFlow('go-back');
  const { gatewayUrl, simRender } = await startGateway(flow);
  const result = await runFlow(flow, { gatewayUrl, simRender });
  expect(result.ok).toBe(true);
  expect(result.steps).toBe(flow.steps.length);
  expect(result.firstDivergence).toBeUndefined();
});

test('guide-start flow completes with ok: true', async () => {
  const flow = loadFlow('guide-start');
  const { gatewayUrl, simRender } = await startGateway(flow);
  const result = await runFlow(flow, { gatewayUrl, simRender });
  expect(result.ok).toBe(true);
  expect(result.steps).toBe(flow.steps.length);
  expect(result.firstDivergence).toBeUndefined();
});

test('divergence: modified expected message reports firstDivergence with the right index', async () => {
  const flow = loadFlow('guide-start');
  const targetIndex = flow.steps.findIndex((s) => s.from === 'server' && s.msg.type === 'goal.ack');
  expect(targetIndex).toBeGreaterThan(0);

  const mutatedFlow: Flow = JSON.parse(JSON.stringify(flow));
  mutatedFlow.steps[targetIndex]!.msg.intent = 'divergent-intent';

  const { gatewayUrl, simRender } = await startGateway(mutatedFlow);
  const result = await runFlow(mutatedFlow, { gatewayUrl, simRender });

  expect(result.ok).toBe(false);
  expect(result.firstDivergence).toBeDefined();
  expect(result.firstDivergence?.index).toBe(targetIndex);
  expect(result.firstDivergence?.expected).toEqual(mutatedFlow.steps[targetIndex]!.msg);
});
