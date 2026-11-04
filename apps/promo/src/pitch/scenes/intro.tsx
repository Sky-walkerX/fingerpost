import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrandMark } from '../../components/brand-mark.tsx';
import { rise } from '../../components/motion.ts';
import { Wipe } from '../../components/wipe.tsx';
import { Scan } from '../../scenes/scan.tsx';
import { color, font, springs } from '../../tokens.ts';
import { cue } from '../cue.ts';

/** The name, then the phone finding the screen. */
export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = cue('intro');
  const scanAt = c.at('Point your phone');
  const mark = spring({ frame: frame - 8, fps, config: springs.snappy });
  return (
    <AbsoluteFill style={{ background: color.night }}>
      <Wipe to="day">
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 44 }}>
            <BrandMark size={170} style={{ transform: `scale(${mark}) rotate(${(1 - mark) * -90}deg)` }} />
            <div style={{ fontFamily: font.display, fontSize: 230, color: color.blue, lineHeight: 1, ...rise(frame, 14) }}>Fingerpost.</div>
          </div>
        </AbsoluteFill>
      </Wipe>
      <Sequence from={scanAt} durationInFrames={c.duration - scanAt}><Scan duration={c.duration - scanAt} beats={[]} /></Sequence>
    </AbsoluteFill>
  );
};
