import narration from './narration.json' with { type: 'json' };

export const SENSORY = { seconds: 56, width: 1920, height: 1080, fps: 60, frames: 3360 } as const;
export type SensorySceneId = 'tension' | 'reveal' | 'proof' | 'confirm' | 'guide' | 'privacy' | 'modes' | 'glasses' | 'close';
const boundaries: readonly [SensorySceneId, number, number][] = [
  ['tension', 0, 4], ['reveal', 4, 8], ['proof', 8, 14], ['confirm', 14, 20],
  ['guide', 20, 29], ['privacy', 29, 35.5], ['modes', 35.5, 41.5], ['glasses', 41.5, 50.5], ['close', 50.5, 56],
];
export const sensoryScenes = boundaries.map(([id, start, end]) => ({ id, from: Math.round(start * 60), duration: Math.round((end - start) * 60) }));
export const captions = narration.segments.map((s) => ({
  id: s.id, text: s.text, kind: s.kind,
  from: Math.round(s.at * 60), end: Math.round((s.at + s.maxDuration) * 60),
}));

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const mix = (a: number, b: number, p: number) => a + (b - a) * clamp(p);

/** Gain follows the edit, leaving actual silence around the PIN lock. */
export function sensoryMusicVolume(frame: number): number {
  const t = frame / 60;
  const opening = 0.48;
  if (t < 0.08) return mix(0.12, opening, t / 0.08);
  if (t < 3.8) return opening;
  if (t < 4.2) return mix(opening, 0.18, (t - 3.8) / 0.4);
  if (t < 13.7) return 0.18;
  if (t < 14) return mix(0.18, 0.045, (t - 13.7) / 0.3);
  if (t < 28) return 0.045;
  if (t < 28.95) return mix(0.045, 0.14, (t - 28) / 0.95);
  if (t < 29) return mix(0.14, 0, (t - 28.95) / 0.05);
  if (t < 30) return 0;
  if (t < 35.5) return mix(0, 0.045, (t - 30) / 0.7);
  if (t < 41.5) return 0.11;
  if (t < 49.5) return 0.16;
  if (t < 50.5) return mix(0.16, 0.32, t - 49.5);
  if (t < 54.2) return 0.14;
  return 0.14 * clamp((55.98 - t) / 1.78);
}

export type GuideStage = 'inactive' | 'right' | 'up' | 'on' | 'checking' | 'done';
/** A staged illustration; tone frequency uses guidance-spec §7, not the old landing-page beep approximation. */
export function guideState(seconds: number): { stage: GuideStage; x: number; y: number; error: number; frequency: number; pan: number; nearPulseHz: number } {
  const t = seconds - 20;
  if (t < 0 || seconds >= 29) return { stage: 'inactive', x: 0, y: 0, error: 0, frequency: 0, pan: 0, nearPulseHz: 0 };
  const right = clamp(t / 2.2), up = clamp((t - 2.2) / 2.6);
  const x = mix(0.14, 0.75, right), y = mix(0.82, 0.52, up);
  const error = Math.hypot((0.75 - x) * 0.65, (0.52 - y) * 0.7);
  const stage: GuideStage = t >= 7.3 ? 'done' : t >= 5.7 ? 'checking' : t >= 4.8 ? 'on' : t >= 2.2 ? 'up' : 'right';
  const active = stage === 'right' || stage === 'up';
  return { stage, x, y, error, frequency: active ? 220 * 2 ** (3 * (1 - Math.min(error / 0.5, 1))) : 0,
    pan: active ? Math.max(-1, Math.min(1, (0.75 - x) / 0.3)) : 0,
    nearPulseHz: active && error < 0.16 ? 4 + 8 * (1 - error / 0.16) : 0 };
}
