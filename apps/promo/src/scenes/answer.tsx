import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrandMark } from '../components/brand-mark.tsx';
import { rise } from '../components/motion.ts';
import { Wipe } from '../components/wipe.tsx';
import { copy } from '../copy.ts';
import { color, font, springs } from '../tokens.ts';

/** Scene 2: the wipe to daylight and the name landing on the beat. */
export const Answer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame: frame - 12, fps, config: springs.snappy });
  return (
    <AbsoluteFill style={{ background: color.night }}>
      <Wipe to="day">
        <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 160 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
            <BrandMark size={190} style={{ transform: `scale(${mark}) rotate(${(1 - mark) * -90}deg)` }} />
            <div style={{ fontFamily: font.display, fontSize: 250, lineHeight: 1, color: color.blue, ...rise(frame, 16) }}>{copy.answer.name}</div>
          </div>
          <div style={{ fontFamily: font.body, fontWeight: 500, fontSize: 56, color: color.muted, marginTop: 36, marginLeft: 238, ...rise(frame, 34) }}>{copy.answer.line}</div>
        </AbsoluteFill>
      </Wipe>
    </AbsoluteFill>
  );
};
