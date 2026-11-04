import { AbsoluteFill, interpolate, random, useCurrentFrame } from 'remotion';
import { Hand } from '../components/hand.tsx';
import { progress } from '../components/motion.ts';
import { Statement } from '../components/statement.tsx';
import { copy } from '../copy.ts';
import { beatsWithin } from '../timeline.ts';
import { color } from '../tokens.ts';

/** Scene 1: a self-checkout face that is only glass, and a hand that cannot find anything to feel. */
export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const beats = beatsWithin('problem');
  const first = beats.find((b) => b >= 6) ?? 6;
  const second = beats.find((b) => b >= first + 60) ?? first + 70;
  const drift = { x: Math.sin(frame / 22) * 70 + Math.sin(frame / 9) * 16, y: Math.cos(frame / 27) * 40 };
  const enter = progress(frame, 0, 40);
  // Uncertain taps that land on nothing.
  const taps = [40, 105, 170].map((t, i) => ({ t, x: 150 + random(`tap-x-${i}`) * 240, y: 200 + random(`tap-y-${i}`) * 300 }));
  return (
    <AbsoluteFill style={{ background: `radial-gradient(70% 80% at 70% 45%, ${color.raised} 0%, ${color.night} 70%)` }}>
      <div style={{ position: 'absolute', left: 130, top: 360 }}>
        <Statement lines={copy.problem} at={[first, second]} tone="night" size={150} />
      </div>
      <div style={{
        position: 'absolute', left: 1250, top: 110, width: 540, height: 800, borderRadius: 48, overflow: 'hidden',
        background: 'linear-gradient(160deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03) 60%)',
        boxShadow: '0 60px 120px -40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.18)',
        opacity: enter, transform: `translateY(${(1 - enter) * 40}px)`,
      }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ position: 'absolute', left: 50 + (i % 2) * 230, top: 110 + Math.floor(i / 2) * 190, width: 210, height: 160, borderRadius: 26, background: 'rgba(255,255,255,0.035)' }} />
        ))}
        <div style={{ position: 'absolute', inset: '-40%', background: 'linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.10) 50%, transparent 58%)', transform: `translateX(${interpolate(frame, [0, 240], [-30, 30])}%)` }} />
        {taps.map(({ t, x, y }) => {
          const p = progress(frame, t, 30);
          return p > 0 && p < 1 ? <div key={t} style={{ position: 'absolute', left: x - 40, top: y - 40, width: 80, height: 80, borderRadius: '50%', border: `3px solid rgba(201,212,234,${0.5 * (1 - p)})`, transform: `scale(${0.4 + p})` }} /> : null;
        })}
      </div>
      <Hand width={320} style={{ position: 'absolute', left: 1380 + drift.x, top: 560 + drift.y + (1 - enter) * 220, transform: 'rotate(-8deg)', filter: 'drop-shadow(0 40px 50px rgba(0,0,0,0.45))' }} />
    </AbsoluteFill>
  );
};
