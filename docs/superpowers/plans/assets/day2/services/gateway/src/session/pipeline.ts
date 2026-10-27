import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
import type { Keyframe, Layout, LayoutElement, Locale, ServerMessage } from '@fingerpost/protocol';
import type { ModelPort } from '../models/port.ts';
import type { Usage } from '../quota/cost.ts';
import { SPOKEN_ERRORS } from '../errors/spoken.ts';
import { resolveByText, tokenSetRatio } from '../resolve/match.ts';
import { describePosition, listLabels } from '../resolve/describe.ts';

/** Sim element ids are kebab-case versions of their labels ("pay-card" ↔ "Pay by card"). */
export const simMatches = (simElementId: string, el: LayoutElement) => { throw new Error('TODO(D2-T6): implement this; the tests describe the behaviour'); };

import type { StartResult } from './types.ts';
export type TaskGate = () => Promise<StartResult>;
export interface PipelineDeps {
  models: ModelPort;
  send: (m: ServerMessage) => void;
  now?: () => number;
  /** Called after every billed model call (Day 3: spend ledger). */
  onUsage?: (u: Usage) => void;
  /** Called once per new goal before its first locate (Day 3: daily quota + kill switch). */
  beforeTask?: TaskGate;
}

/** sha256 of the sorted normalized labels, as "sh64:<16 hex>". Day 5 replaces this with SimHash (kiosk memory). */
export function layoutFingerprint(elements: readonly LayoutElement[]): string {
  throw new Error('TODO(D2-T6): implement this; the tests describe the behaviour');
}

/** Jaccard similarity of two layouts' normalized label sets. */
export function labelJaccard(a: readonly LayoutElement[], b: readonly LayoutElement[]): number {
  throw new Error('TODO(D2-T6): implement this; the tests describe the behaviour');
}

/**
 * Day 2 session brain: goal → keyframe(locate) → layout + target | ask; keyframe(verify) → verify.
 * The agent loop (Day 4) replaces the single-target logic but keeps these message shapes.
 */
export class SessionPipeline {
  private goal: string | null = null;
  private locale: Locale = 'en';
  private layout: Layout | null = null;
  private target: LayoutElement | null = null;
  private lastTap: { keyframeId: string | null; simElementId: string | null } = { keyframeId: null, simElementId: null };
  private taskCharged = false;

  constructor(private readonly d: PipelineDeps) {}
  private now() {
    throw new Error('TODO(D2-T6): implement this; the tests describe the behaviour');
  }
  private base() {
    throw new Error('TODO(D2-T6): implement this; the tests describe the behaviour');
  }

  setLocale(l: Locale) {
    throw new Error('TODO(D2-T6): implement this; the tests describe the behaviour');
  }

  onGoal(text: string): void {
    throw new Error('TODO(D2-T6): implement this; the tests describe the behaviour');
  }

  /** The sim reported a touch for this session's run. Remembered as press evidence for the next verify. */
  onSimTouch(elementId: string | null): void {
    throw new Error('TODO(D2-T6): implement this; the tests describe the behaviour');
  }

  async onKeyframe(h: Keyframe, jpeg: Uint8Array): Promise<void> {
    throw new Error('TODO(D2-T6): implement this; the tests describe the behaviour');
  }

  private verify(h: Keyframe, before: Layout | null, after: Layout): void {
    throw new Error('TODO(D2-T6): implement this; the tests describe the behaviour');
  }
}
