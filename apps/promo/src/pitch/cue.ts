import { phraseAt, pitchScene, type PitchSceneId } from './timeline.ts';

/** Scene-relative frame where a narrated phrase is spoken, so visuals land on the words. */
export function cue(id: PitchSceneId) {
  const s = pitchScene(id);
  return { duration: s.duration, voAt: s.voAt, at: (phrase: string) => s.voAt + phraseAt(id, phrase) };
}
