import narration from './narration.json' with { type: 'json' };
import durations from './vo-durations.json' with { type: 'json' };
import { FPS } from '../tokens.ts';

export type PitchSceneId = 'hook' | 'problem' | 'intro' | 'how' | 'models' | 'safety' | 'everyone' | 'glasses' | 'close' | 'demo';

/** A breath before each clip and a short hold after it. */
const LEAD = 0.5, TAIL = 0.9;
export const DEMO_FRAMES = 60 * FPS;

const vo = durations as Record<string, number>;

function build() {
  const out: { id: PitchSceneId; from: number; duration: number; voAt: number }[] = [];
  let from = 0;
  for (const seg of narration.segments) {
    const duration = Math.ceil((LEAD + vo[seg.id]! + TAIL) * FPS);
    out.push({ id: seg.id as PitchSceneId, from, duration, voAt: Math.round(LEAD * FPS) });
    from += duration;
  }
  out.push({ id: 'demo', from, duration: DEMO_FRAMES, voAt: 0 });
  return out;
}

export const pitchScenes = build();
export const PITCH_TOTAL = pitchScenes.at(-1)!.from + pitchScenes.at(-1)!.duration;
export const pitchScene = (id: PitchSceneId) => pitchScenes.find((s) => s.id === id)!;

/** Sentence start frames inside a voice clip, spread by length; good enough for burned-in subtitles. */
export function sentenceTimes(id: string): { text: string; at: number }[] {
  const text = narration.segments.find((s) => s.id === id)!.text;
  const sentences = text.split(/(?<=[.!?])\s+/);
  const total = sentences.reduce((n, s) => n + s.length, 0);
  const clip = vo[id]! * FPS;
  let chars = 0;
  return sentences.map((s) => { const at = Math.round((chars / total) * clip); chars += s.length; return { text: s, at }; });
}

/** Where a phrase starts inside a clip (frames from clip start), for syncing visuals to words. */
export function phraseAt(id: string, phrase: string): number {
  const text = narration.segments.find((s) => s.id === id)!.text;
  const i = text.indexOf(phrase);
  if (i < 0) throw new Error(`"${phrase}" is not in the ${id} narration`);
  return Math.round((i / text.length) * vo[id]! * FPS);
}
