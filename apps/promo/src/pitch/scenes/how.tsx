import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { progress, rise } from '../../components/motion.ts';
import { Guide } from '../../scenes/guide.tsx';
import { color, font } from '../../tokens.ts';
import { cue } from '../cue.ts';

const STEPS = ['Choose a drink', 'Pick a size', 'Pay by card'];

/** Directions, tone and buzz on one button; then a whole order, one step at a time. */
export const How: React.FC = () => {
  const frame = useCurrentFrame();
  const c = cue('how');
  const orderAt = c.at('Because it reads the whole screen');
  const fade = progress(frame, orderAt - 10, 16);
  return (
    <AbsoluteFill style={{ background: color.day }}>
      <Sequence durationInFrames={orderAt + 6}><AbsoluteFill style={{ opacity: 1 - fade }}><Guide beats={[]} /></AbsoluteFill></Sequence>
      {frame >= orderAt - 10 ? (
        <AbsoluteFill style={{ background: color.day, opacity: fade, justifyContent: 'center', paddingLeft: 130 }}>
          <div style={{ fontFamily: font.display, fontSize: 110, color: color.ink, marginBottom: 70, ...rise(frame, orderAt) }}>A whole order, one step at a time.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
            {STEPS.map((step, i) => {
              const at = orderAt + 30 + i * 45;
              const done = progress(frame, at + 30, 12);
              return (
                <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 30, ...rise(frame, at) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '26px 34px', borderRadius: 28, background: done > 0.5 ? color.blue : color.panel, color: done > 0.5 ? '#fff' : color.ink, fontFamily: font.body, fontWeight: 600, fontSize: 44 }}>
                    <span style={{ width: 46, height: 46, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 28, background: done > 0.5 ? 'rgba(255,255,255,0.2)' : '#fff', color: done > 0.5 ? '#fff' : color.blue }}>{i + 1}</span>{step}
                  </div>
                  {i < STEPS.length - 1 ? <div style={{ width: 60, height: 4, borderRadius: 2, background: color.periwinkle, transform: `scaleX(${done})`, transformOrigin: 'left' }} /> : null}
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
