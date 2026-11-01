import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildFastFood } from '../src/sim/scenes/fastfood.ts';

const flowsDir = new URL('../../../packages/protocol/fixtures/flows/', import.meta.url);
const mediumCola = JSON.parse(readFileSync(new URL('medium-cola.json', flowsDir), 'utf-8'));
const guideStart = JSON.parse(readFileSync(new URL('guide-start.json', flowsDir), 'utf-8'));

describe('flows match sim graph', () => {
  test('flows match the sim graph', () => {
    for (const flow of [mediumCola, guideStart]) {
      expect(flow.scene).toBe('fastfood');
      const scene = buildFastFood(flow.seed);
      const screenMap = new Map(scene.screens.map((s) => [s.id, s]));

      // 1. Every screen referenced in the flow exists in the sim scene
      const flowScreens: string[] = [...new Set(flow.steps.map((step: Record<string, unknown>) => step.screen))].filter((screen): screen is string => typeof screen === 'string');
      for (const screenId of flowScreens) {
        expect(screenMap.has(screenId), `Screen "${screenId}" from ${flow.name} should exist in scene`).toBe(true);
      }

      // 2. Extract screen transitions from touches in the flow
      const touches: Array<{ screenId: string; elementId: string }> = [];
      for (const step of flow.steps) {
        if (step.msg && step.msg.type === 'sim.touch') {
          touches.push({ screenId: step.msg.screenId, elementId: step.msg.elementId });
        }
      }

      // 3. Follow the touch sequence through the sim scene graph
      let currentScreenId = scene.start;
      for (const touch of touches) {
        expect(currentScreenId).toBe(touch.screenId);
        const screen = screenMap.get(currentScreenId)!;
        const nextScreenId = screen.next[touch.elementId];
        expect(nextScreenId).toBeDefined();
        currentScreenId = nextScreenId!;
      }

      // 4. The end screen of the sim graph traversal must match the final screen in the flow
      const finalFlowScreen = flow.steps.filter((s: { screen?: string }) => Boolean(s.screen)).at(-1)?.screen;
      expect(currentScreenId).toBe(finalFlowScreen);
    }
  });
});
