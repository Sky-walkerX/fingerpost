import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { progress, rise } from '../../components/motion.ts';
import { color, font } from '../../tokens.ts';
import { cue } from '../cue.ts';

/** Waiting, walking away, and handing a card and PIN to a stranger. */
export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const c = cue('problem');
  const handAt = c.at('they often have to hand');
  const away = progress(frame, handAt + 10, 50);
  return (
    <AbsoluteFill style={{ background: color.night }}>
      <div style={{ position: 'absolute', left: 130, top: 230, fontFamily: font.display, fontSize: 128, lineHeight: 1.06, color: '#fff' }}>
        <div style={rise(frame, c.at('So they wait'))}>They wait for help,</div>
        <div style={{ ...rise(frame, c.at('or they walk away')), fontStyle: 'italic', color: color.nightText }}>or walk away.</div>
      </div>
      <div style={{ position: 'absolute', left: 130, top: 640, fontFamily: font.body, fontWeight: 600, fontSize: 46, color: color.peach, ...rise(frame, handAt) }}>At the payment screen, their card and PIN go to a stranger.</div>
      <div style={{ position: 'absolute', left: interpolate(away, [0, 1], [1180, 1520]), top: 330, transform: `rotate(${-8 + away * 14}deg)`, opacity: progress(frame, handAt, 16) * (1 - 0.6 * away) }}>
        <div style={{ width: 360, height: 228, borderRadius: 26, background: `linear-gradient(135deg, ${color.blue}, #1f3f99)`, boxShadow: '0 40px 80px -30px rgba(0,0,0,0.6)', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 30, top: 40, width: 60, height: 44, borderRadius: 10, background: '#e8c98f' }} />
          <div style={{ position: 'absolute', left: 30, bottom: 34, display: 'flex', gap: 14 }}>{[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', opacity: 0.85 }} />)}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
