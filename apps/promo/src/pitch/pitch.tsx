import { Fragment } from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { useFontsReady } from '../fonts.ts';
import { color } from '../tokens.ts';
import { CloseScene } from './scenes/close.tsx';
import { Demo } from './scenes/demo.tsx';
import { Everyone } from './scenes/everyone.tsx';
import { GlassesScene } from './scenes/glasses.tsx';
import { Hook } from './scenes/hook.tsx';
import { How } from './scenes/how.tsx';
import { Intro } from './scenes/intro.tsx';
import { Models } from './scenes/models.tsx';
import { Problem } from './scenes/problem.tsx';
import { Safety } from './scenes/safety.tsx';
import { Subtitles } from './subtitles.tsx';
import { DEMO_FRAMES, PITCH_TOTAL, pitchScenes, type PitchSceneId } from './timeline.ts';

const SCENE: Record<PitchSceneId, React.FC> = { hook: Hook, problem: Problem, intro: Intro, how: How, models: Models, safety: Safety, everyone: Everyone, glasses: GlassesScene, close: CloseScene, demo: Demo };
const EXPLAINER = PITCH_TOTAL - DEMO_FRAMES;

/** Quiet music bed under the narration, faded out before the live demo. */
function bedVolume(frame: number): number {
  const fadeIn = Math.min(1, frame / 60), fadeOut = Math.max(0, Math.min(1, (EXPLAINER - frame) / 90));
  return 0.12 * fadeIn * fadeOut;
}

export const Pitch: React.FC = () => {
  useFontsReady();
  return (
    <AbsoluteFill style={{ background: color.night }}>
      <Sequence durationInFrames={EXPLAINER}><Audio src={staticFile('music/upbeat-rock.mp3')} trimBefore={Math.round(5.927 * 60)} volume={bedVolume} /></Sequence>
      {pitchScenes.map((s) => {
        const Scene = SCENE[s.id];
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.duration} name={s.id}>
            <Scene />
            {s.id !== 'demo' ? <Fragment>
              <Sequence from={s.voAt}><Audio src={staticFile(`vo/${s.id}.wav`)} /></Sequence>
              <Subtitles id={s.id} voAt={s.voAt} />
            </Fragment> : null}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
