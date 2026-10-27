import { hitTest } from './hit.ts';
import { CANVAS, type Label, type RunState, type SimScene, type SimScreen, type TouchEvent } from './model.ts';

export const newRun = (runId: string, scene: SimScene): RunState => ({ runId, scene, screenId: scene.start, events: [] });
export const currentScreen = (s: RunState): SimScreen => {
  const screen = s.scene.screens.find((screen) => screen.id === s.screenId);
  if (!screen) throw new Error(`Unknown simulator screen: ${s.screenId}`);
  return screen;
};

/** Logs every touch (misses included, elementId null) and follows the screen's `next` map. Coordinates are canvas px. */
export function applyTouch(state: RunState, t: { x: number; y: number; pointerId: number; ts: number }): TouchEvent {
  const screen = currentScreen(state);
  const hit = hitTest(screen.elements, t.x, t.y);
  const event: TouchEvent = { ...t, runId: state.runId, screenId: screen.id,
    u: Math.min(1, Math.max(0, t.x / CANVAS.w)), v: Math.min(1, Math.max(0, t.y / CANVAS.h)),
    elementId: hit?.id ?? null };
  state.events.push(event);
  const next = hit ? screen.next[hit.id] : undefined;
  if (next !== undefined) state.screenId = next;
  return event;
}

export const exportRun = (s: RunState): string => JSON.stringify({ runId: s.runId, scene: s.scene.id, seed: s.scene.seed, events: s.events }, null, 2);

/** Ground-truth labels for evals: element boxes normalized to the canvas. */
export const labelsFor = (screen: SimScreen): Label[] => screen.elements.map(({ id, label, role, rect }) => ({
  id, label, role, u: rect.x / CANVAS.w, v: rect.y / CANVAS.h, w: rect.w / CANVAS.w, h: rect.h / CANVAS.h,
}));
