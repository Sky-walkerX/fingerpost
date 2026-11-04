import beats from './beats.json' with { type: 'json' };
import { FPS } from './tokens.ts';

export type SceneId = 'problem' | 'answer' | 'scan' | 'confirm' | 'guide' | 'privacy' | 'close';

/** Target lengths in seconds from the approved storyboard; each boundary then snaps to the nearest beat. */
const TARGET: readonly [SceneId, number][] = [
  ['problem', 4], ['answer', 3], ['scan', 7], ['confirm', 6], ['guide', 9], ['privacy', 9], ['close', 8],
];

const beatFrames = beats.beats.map((b) => Math.round(b * FPS));
const snap = (frame: number) => beatFrames.reduce((best, f) => (Math.abs(f - frame) < Math.abs(best - frame) ? f : best), beatFrames[0]!);

function build() {
  const out: { id: SceneId; from: number; duration: number }[] = [];
  let elapsed = 0, from = 0;
  for (const [id, seconds] of TARGET) {
    elapsed += seconds;
    const end = snap(elapsed * FPS);
    out.push({ id, from, duration: end - from });
    from = end;
  }
  return out;
}

export const scenes = build();
export const TOTAL_FRAMES = scenes.at(-1)!.from + scenes.at(-1)!.duration;
export const sceneOf = (id: SceneId) => scenes.find((s) => s.id === id)!;
export const music = { offsetSec: beats.offsetSec, bpm: beats.bpm, beatFrames };

const FADE_FRAMES = 90;
const LEVEL = 0.9;
/** Full level, then a linear fade to silence over the final 1.5 s so the track never cuts off. */
export function musicVolume(frame: number): number {
  const fadeStart = TOTAL_FRAMES - FADE_FRAMES;
  if (frame < fadeStart) return LEVEL;
  return Math.max(0, LEVEL * (1 - (frame - fadeStart) / (FADE_FRAMES - 1)));
}

/** Beat frames inside a scene, relative to the scene's first frame, for beat-synced entrances. */
export function beatsWithin(id: SceneId): number[] {
  const s = sceneOf(id);
  return beatFrames.filter((f) => f >= s.from && f < s.from + s.duration).map((f) => f - s.from);
}
