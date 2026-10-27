import type { ParsedLayout } from '../../parse/spark-parse.ts';
import type { ModelPort } from '../port.ts';

/** A microwave panel: Start (bottom right), Stop (bottom left), Timer, Power, and the display text. */
export const MOCK_LAYOUT: ParsedLayout = {
  screenType: 'appliance', sensitivity: 'none', language: 'en', rotation: 0,
  elements: [
    { id: 'e1', label: '00:00', role: 'text', polygon: [{ u: 0.3, v: 0.1 }, { u: 0.7, v: 0.1 }, { u: 0.7, v: 0.25 }, { u: 0.3, v: 0.25 }], textNorm: '00 00', confidence: 0.9 },
    { id: 'e2', label: 'Timer', role: 'button', polygon: [{ u: 0.1, v: 0.4 }, { u: 0.4, v: 0.4 }, { u: 0.4, v: 0.55 }, { u: 0.1, v: 0.55 }], textNorm: 'timer', confidence: 0.92 },
    { id: 'e3', label: 'Power', role: 'button', polygon: [{ u: 0.6, v: 0.4 }, { u: 0.9, v: 0.4 }, { u: 0.9, v: 0.55 }, { u: 0.6, v: 0.55 }], textNorm: 'power', confidence: 0.92 },
    { id: 'e4', label: 'Stop', role: 'cancel', polygon: [{ u: 0.1, v: 0.7 }, { u: 0.4, v: 0.7 }, { u: 0.4, v: 0.88 }, { u: 0.1, v: 0.88 }], textNorm: 'stop', confidence: 0.95 },
    { id: 'e5', label: 'Start', role: 'button', polygon: [{ u: 0.6, v: 0.7 }, { u: 0.9, v: 0.7 }, { u: 0.9, v: 0.88 }, { u: 0.6, v: 0.88 }], textNorm: 'start', confidence: 0.95 },
  ],
};

/**
 * MODEL_MODE=mock. Deterministic and offline. SAM returns the prompt box shrunk by 2% on each side
 * (normalized to the image) so tests can tell a refined polygon from the Spark box.
 */
export function mockModels(layout: ParsedLayout = MOCK_LAYOUT): ModelPort {
  return {
    parseScreen: async () => ({ layout, usage: { inputTokens: 0, outputTokens: 0 }, latencyMs: 0, promptId: 'mock' }),
    segmentByBox: async (img, b) => {
      const dx = (b.right - b.left) * 0.02, dy = (b.bottom - b.top) * 0.02;
      const L = (b.left + dx) / img.width, R = (b.right - dx) / img.width, T = (b.top + dy) / img.height, B = (b.bottom - dy) / img.height;
      return { polygon: [{ u: L, v: T }, { u: R, v: T }, { u: R, v: B }, { u: L, v: B }], confidence: 0.9, latencyMs: 0 };
    },
    segmentByText: async () => ({ polygon: [{ u: 0.05, v: 0.05 }, { u: 0.95, v: 0.05 }, { u: 0.95, v: 0.95 }, { u: 0.05, v: 0.95 }], confidence: 0.9, latencyMs: 0 }),
  };
}
