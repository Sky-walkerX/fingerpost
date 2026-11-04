import { AbsoluteFill, Sequence } from 'remotion';
import { useFontsReady } from './fonts.ts';
import { Music } from './music.tsx';
import { Answer } from './scenes/answer.tsx';
import { Confirm } from './scenes/confirm.tsx';
import { Guide } from './scenes/guide.tsx';
import { Close } from './scenes/close.tsx';
import { Privacy } from './scenes/privacy.tsx';
import { Problem } from './scenes/problem.tsx';
import { Scan } from './scenes/scan.tsx';
import { scenes, type SceneId } from './timeline.ts';
import { color } from './tokens.ts';

const SCENE: Record<SceneId, React.FC> = {
  problem: Problem,
  answer: Answer,
  scan: Scan,
  confirm: Confirm,
  guide: Guide,
  privacy: Privacy,
  close: Close,
};

export const Promo: React.FC = () => {
  useFontsReady();
  return (
    <AbsoluteFill style={{ background: color.night }}>
      <Music />
      {scenes.map((s) => {
        const Scene = SCENE[s.id];
        return <Sequence key={s.id} from={s.from} durationInFrames={s.duration} name={s.id}><Scene /></Sequence>;
      })}
    </AbsoluteFill>
  );
};
