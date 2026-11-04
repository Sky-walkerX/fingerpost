import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { progress, rise } from '../../components/motion.ts';
import { Wipe } from '../../components/wipe.tsx';
import { color, font } from '../../tokens.ts';
import { cue } from '../cue.ts';

const Glasses: React.FC<{ glow: number }> = ({ glow }) => (
  <svg width="420" height="170" viewBox="0 0 210 85" aria-hidden="true">
    <path d="M10 30 h75 a6 6 0 0 1 6 6 v14 a26 26 0 0 1 -26 26 h-30 a26 26 0 0 1 -26 -26 v-14 a6 6 0 0 1 1 -6z M119 30 h75 a6 6 0 0 1 6 6 v14 a26 26 0 0 1 -26 26 h-30 a26 26 0 0 1 -26 -26 v-14 a6 6 0 0 1 1 -6z M91 40 q14 -8 28 0 M10 32 l-8 -12 M200 32 l8 -12" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
    <circle cx="22" cy="40" r="5" fill={color.peach} opacity={0.4 + 0.6 * glow} />
  </svg>
);

/** One camera interface today; Meta's camera glasses next. */
export const GlassesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const c = cue('glasses');
  const nextAt = c.at('So next');
  const flow = progress(frame, c.at('through one interface'), 30);
  const glasses = progress(frame, nextAt, 24);
  return (
    <AbsoluteFill style={{ background: color.day }}>
      <Wipe to="night">
        <AbsoluteFill style={{ background: `radial-gradient(60% 70% at 50% 45%, ${color.raised} 0%, ${color.night} 72%)` }}>
          <div style={{ position: 'absolute', left: 130, top: 120, display: 'flex', flexDirection: 'column', gap: 70 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 34, ...rise(frame, c.voAt) }}>
              <div style={{ width: 120, height: 220, borderRadius: 26, background: '#1f3260' }} />
              <div style={{ fontFamily: font.body, fontWeight: 600, fontSize: 40, color: color.nightText }}>Phone camera <span style={{ color: color.periwinkle }}>· today</span></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 34, opacity: glasses, transform: `translateY(${(1 - glasses) * 30}px)` }}>
              <Glasses glow={glasses} />
              <div style={{ fontFamily: font.body, fontWeight: 600, fontSize: 40, color: color.nightText }}>Meta camera glasses <span style={{ padding: '6px 16px', borderRadius: 999, background: 'rgba(255,185,143,0.16)', color: color.peach, fontSize: 30 }}>Next</span></div>
            </div>
          </div>
          <div style={{ position: 'absolute', left: 980, top: 420, width: 260, height: 4, borderRadius: 2, background: color.periwinkle, transform: `scaleX(${flow})`, transformOrigin: 'left' }} />
          <div style={{ position: 'absolute', left: 1270, top: 330, padding: '40px 46px', borderRadius: 34, background: color.raised, color: '#fff', fontFamily: font.body, fontWeight: 600, fontSize: 40, lineHeight: 1.4, opacity: flow }}>
            One camera interface<br /><span style={{ color: color.periwinkle }}>→ Fingerpost guidance</span>
          </div>
          <div style={{ position: 'absolute', left: 130, top: 760, fontFamily: font.display, fontStyle: 'italic', fontSize: 120, color: '#fff', ...rise(frame, c.at('completely hands-free')) }}>Completely hands-free.</div>
        </AbsoluteFill>
      </Wipe>
    </AbsoluteFill>
  );
};
