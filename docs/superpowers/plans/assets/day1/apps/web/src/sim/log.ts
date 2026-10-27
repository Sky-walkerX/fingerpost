import { hitTest } from './hit.ts';
import { CANVAS, type Label, type RunState, type SimScene, type SimScreen, type TouchEvent } from './model.ts';

export const newRun = (runId: string, scene: SimScene): RunState => { throw new Error('TODO(D1-T6): implement this; the tests describe the behaviour'); };
export const currentScreen = (s: RunState): SimScreen => { throw new Error('TODO(D1-T6): implement this; the tests describe the behaviour'); };

/** Logs every touch (misses included, elementId null) and follows the screen's `next` map. Coordinates are canvas px. */
export function applyTouch(state: RunState, t: { x: number; y: number; pointerId: number; ts: number }): TouchEvent {
  throw new Error('TODO(D1-T6): implement this; the tests describe the behaviour');
}

export const exportRun = (s: RunState): string => { throw new Error('TODO(D1-T6): implement this; the tests describe the behaviour'); };

/** Ground-truth labels for evals: element boxes normalized to the canvas. */
export const labelsFor = (screen: SimScreen): Label[] =>{ throw new Error('TODO(D1-T6): implement this; the tests describe the behaviour'); };
