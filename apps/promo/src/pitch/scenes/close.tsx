import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrandMark } from '../../components/brand-mark.tsx';
import { rise } from '../../components/motion.ts';
import { Wipe } from '../../components/wipe.tsx';
import { copy } from '../../copy.ts';
import { color, font, springs } from '../../tokens.ts';
import { cue } from '../cue.ts';

/** The end card, then the hand-off to the live demo. */
export const CloseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = cue('close');
  const live = c.at("Let's see it live");
  const card = spring({ frame: frame - 6, fps, config: springs.calm });
  return (
    <AbsoluteFill style={{ background: color.night }}>
      <Wipe to="day">
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 44, transform: `scale(${0.92 + 0.08 * card})`, opacity: card }}>
            <BrandMark size={170} />
            <div style={{ fontFamily: font.display, fontSize: 220, color: color.ink, lineHeight: 1 }}>Fingerpost.</div>
          </div>
          <div style={{ marginTop: 36, fontFamily: font.body, fontWeight: 600, fontSize: 48, color: color.blue, ...rise(frame, c.at('Free, open source')) }}>{copy.close.tag} · {copy.close.url}</div>
        </AbsoluteFill>
      </Wipe>
      {frame >= live ? <Wipe start={live} to="night"><AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontFamily: font.display, fontSize: 200, color: '#fff', ...rise(frame, live + 8) }}>Live demo</div>
      </AbsoluteFill></Wipe> : null}
    </AbsoluteFill>
  );
};
