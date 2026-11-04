import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { progress, rise } from '../../components/motion.ts';
import { color, font } from '../../tokens.ts';
import { cue } from '../cue.ts';

const PLACES = [['Self-checkouts', 'Self-checkouts'], ['ticket machines', 'Ticket machines'], ['airport check-in', 'Airport check-in'], ['washing machines', 'Washing machines']] as const;

/** Flat screens arrive one by one as they are named, then go dark: nothing to feel. */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const c = cue('hook');
  const nothing = c.at('For a blind person');
  const dim = progress(frame, nothing, 24);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(70% 80% at 50% 40%, ${color.raised} 0%, ${color.night} 72%)` }}>
      <div style={{ position: 'absolute', left: 130, top: 110, fontFamily: font.display, fontSize: 104, color: '#fff', lineHeight: 1.05, ...rise(frame, c.voAt) }}>More of the world sits behind flat glass.</div>
      <div style={{ position: 'absolute', left: 130, right: 130, top: 400, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40, opacity: 1 - 0.75 * dim }}>
        {PLACES.map(([phrase, label], i) => {
          const at = c.at(phrase);
          const p = progress(frame, at, 22);
          return (
            <div key={label} style={{ opacity: p, transform: `translateY(${(1 - p) * 50}px) scale(${0.94 + 0.06 * p})` }}>
              <div style={{ height: 330, borderRadius: 36, background: 'linear-gradient(160deg, rgba(255,255,255,0.13), rgba(255,255,255,0.03) 60%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 40px 80px -40px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden' }}>
                {[0, 1, 2, 3].map((k) => <div key={k} style={{ position: 'absolute', left: 28 + (k % 2) * 150, top: 40 + Math.floor(k / 2) * 130, width: 130, height: 104, borderRadius: 20, background: 'rgba(255,255,255,0.05)' }} />)}
                <div style={{ position: 'absolute', inset: '-40%', background: 'linear-gradient(115deg, transparent 44%, rgba(255,255,255,0.10) 50%, transparent 56%)', transform: `translateX(${((frame + i * 40) % 240) / 2.4 - 50}%)` }} />
              </div>
              <div style={{ marginTop: 22, fontFamily: font.body, fontWeight: 600, fontSize: 36, color: color.nightText }}>{label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 470, textAlign: 'center', fontFamily: font.display, fontStyle: 'italic', fontSize: 200, color: '#fff', ...rise(frame, c.at('nothing to feel')) }}>Nothing to feel.</div>
    </AbsoluteFill>
  );
};
