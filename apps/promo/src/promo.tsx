import { AbsoluteFill, Sequence } from 'remotion';
import { useFontsReady } from './fonts.ts';
import { Answer } from './scenes/answer.tsx';
import { Problem } from './scenes/problem.tsx';
import { Scan } from './scenes/scan.tsx';
import { scenes, type SceneId } from './timeline.ts';
import { color } from './tokens.ts';

const Placeholder: React.FC<{ tone: 'day' | 'night' }> = ({ tone }) => <AbsoluteFill style={{ background: tone === 'day' ? color.day : color.night }} />;

const SCENE: Record<SceneId, React.FC> = {
  problem: Problem,
  answer: Answer,
  scan: Scan,
  confirm: () => <Placeholder tone="day" />,
  guide: () => <Placeholder tone="day" />,
  privacy: () => <Placeholder tone="night" />,
  close: () => <Placeholder tone="day" />,
};

export const Promo: React.FC = () => {
  useFontsReady();
  return (
    <AbsoluteFill style={{ background: color.night }}>
      {scenes.map((s) => {
        const Scene = SCENE[s.id];
        return <Sequence key={s.id} from={s.from} durationInFrames={s.duration} name={s.id}><Scene /></Sequence>;
      })}
    </AbsoluteFill>
  );
};
