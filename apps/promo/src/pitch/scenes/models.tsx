import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Bubble } from '../../components/bubble.tsx';
import { KioskScreen } from '../../components/kiosk-screen.tsx';
import { progress, rise } from '../../components/motion.ts';
import { color, font } from '../../tokens.ts';
import { cue } from '../cue.ts';

const SCREEN = { left: 1130, top: 170, width: 600 };
// Element boxes on the 600 × 800 kiosk screen, as Spark would report them.
const BOXES = [[44, 44, 512, 52], [44, 120, 512, 78], [44, 212, 512, 78], [44, 304, 512, 78], [44, 514, 512, 63], [44, 599, 512, 116]];
const ROWS = [
  ['Voice Transcribe', 'Your words become a goal.'],
  ['Muse Spark', 'Reads every button on the screen.'],
  ['SAM 3.1', 'Outlines the exact one you need.'],
  ['On your phone', 'Tracks your finger at camera speed.'],
] as const;

/** The pipeline, shown on one screen: hear the goal, read the buttons, outline the target, track the finger. */
export const Models: React.FC = () => {
  const frame = useCurrentFrame();
  const c = cue('models');
  const t = [c.at('Voice Transcribe'), c.at('Muse Spark'), c.at('SAM 3.1'), c.at('And the phone tracks')];
  const lit = t.filter((x) => frame >= x).length - 1;
  const read = progress(frame, t[1]!, 40);
  const outline = progress(frame, t[2]!, 30);
  const track = progress(frame, t[3]!, 80);
  const btn = BOXES[5]!;
  const perim = 2 * (btn[2]! + btn[3]!);
  const fx = interpolate(track, [0, 1], [SCREEN.left + 140, SCREEN.left + 300]), fy = interpolate(track, [0, 1], [SCREEN.top + 760, SCREEN.top + 657]);
  return (
    <AbsoluteFill style={{ background: color.day }}>
      <div style={{ position: 'absolute', left: 130, top: 120, fontFamily: font.display, fontSize: 96, color: color.ink, ...rise(frame, c.voAt) }}>Meta's models do the seeing.</div>
      <div style={{ position: 'absolute', left: 130, top: 300, display: 'flex', flexDirection: 'column', gap: 26, width: 820 }}>
        {ROWS.map(([name, line], i) => (
          <div key={name} style={{ ...rise(frame, t[i]! - 4), display: 'flex', alignItems: 'baseline', gap: 26, padding: '24px 30px', borderRadius: 26, background: i === lit ? color.night : color.panel, color: i === lit ? '#fff' : color.ink, transition: 'none' }}>
            <span style={{ fontFamily: font.body, fontWeight: 700, fontSize: 40, minWidth: 300 }}>{name}</span>
            <span style={{ fontFamily: font.body, fontWeight: 500, fontSize: 32, color: i === lit ? color.nightText : color.muted }}>{line}</span>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: SCREEN.left, top: SCREEN.top, borderRadius: 30, overflow: 'hidden', boxShadow: '0 50px 90px -40px rgba(13,24,48,0.5)' }}>
        <KioskScreen width={SCREEN.width} />
        <svg width={600} height={800} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden="true">
          {BOXES.map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} rx={16} fill="none" stroke={color.blue} strokeWidth={3} strokeDasharray="10 8" opacity={read * (1 - 0.6 * outline) * (i / BOXES.length < read ? 1 : 0)} />)}
          <rect x={btn[0]! - 8} y={btn[1]! - 8} width={btn[2]! + 16} height={btn[3]! + 16} rx={34} fill="none" stroke={color.peach} strokeWidth={8} strokeDasharray={perim + 64} strokeDashoffset={(perim + 64) * (1 - outline)} />
        </svg>
      </div>
      {frame >= t[0]! && frame < t[1]! + 40 ? <div style={{ position: 'absolute', left: SCREEN.left + 60, top: SCREEN.top + 300, opacity: 1 - progress(frame, t[1]!, 30) }}><Bubble who="you" text="Pay by card" at={t[0]!} speaking={[t[0]!, t[0]! + 50]} /></div> : null}
      {track > 0 ? <div style={{ position: 'absolute', left: fx - 26, top: fy - 26, width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,185,143,0.95)', boxShadow: '0 0 0 14px rgba(255,185,143,0.3)' }} /> : null}
    </AbsoluteFill>
  );
};
