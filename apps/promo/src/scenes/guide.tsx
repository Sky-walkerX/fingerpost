import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { KioskScreen } from '../components/kiosk-screen.tsx';
import { progress } from '../components/motion.ts';
import { Rings } from '../components/rings.tsx';
import { ToneLine } from '../components/tone-line.tsx';
import { appQuote, directions } from '../copy.ts';
import { beatsWithin } from '../timeline.ts';
import { color, font, springs } from '../tokens.ts';

const SCREEN = { left: 1180, top: 150, width: 560 };
const TARGET = { x: 1460, y: 778 };
const LINES = [directions[0], directions[1], appQuote.pressNow, appQuote.done];
const LEVELS = [0.4, 0.72, 1, 1];

/** Scene 5: directions as you move, a tone that rises, a buzz on target, the press, then a check that it worked. */
export const Guide: React.FC<{ beats?: number[] }> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beats = props.beats ?? beatsWithin('guide');
  const at = (min: number) => beats.find((b) => b >= min) ?? min;
  const t = [at(10)];
  t.push(at(t[0]! + 110)); t.push(at(t[1]! + 100)); t.push(at(t[2]! + 110));
  const current = t.filter((x) => frame >= x).length - 1;
  const level = current < 0 ? 0.12 : interpolate(frame, [t[current]!, t[current]! + 20], [current === 0 ? 0.12 : LEVELS[current - 1]!, LEVELS[current]!], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const path: [number, number][] = [[1235, 880], [1455, 880], [1460, 870], [TARGET.x, TARGET.y]];
  const legStart = [0, t[0]!, t[1]!, t[2]! - 30];
  const leg = Math.max(0, legStart.filter((s) => frame >= s).length - 1);
  const from = path[Math.max(0, leg - 1)]!, to = path[leg]!;
  const p = leg === 0 ? 1 : spring({ frame: frame - legStart[leg]!, fps, config: springs.calm });
  const pressAt = t[2]! + 40;
  const press = progress(frame, pressAt, 8) * (1 - progress(frame, pressAt + 10, 14));
  const shake = frame >= t[2]! && frame < t[2]! + 18 ? Math.sin((frame - t[2]!) * 2.4) * 6 : 0;
  const fx = from[0] + (to[0] - from[0]) * p + shake, fy = from[1] + (to[1] - from[1]) * p;
  return (
    <AbsoluteFill style={{ background: color.day }}>
      <ol style={{ position: 'absolute', left: 130, top: 170, margin: 0, padding: 0, listStyle: 'none', fontFamily: font.display, fontSize: 128, lineHeight: 1.02 }}>
        {LINES.map((line, i) => (
          <li key={line} style={{ color: i === current ? color.ink : i < current ? color.blue : '#c9d3e6', fontStyle: i < current ? 'italic' : 'normal', transform: i === current ? `translateX(${(1 - progress(frame, t[i]!, 16)) * -26}px)` : 'none' }}>{line}</li>
        ))}
      </ol>
      <div style={{ position: 'absolute', left: 130, top: 820 }}><ToneLine level={level} width={880} height={120} /></div>
      <div style={{ position: 'absolute', ...SCREEN, borderRadius: 34, overflow: 'hidden', boxShadow: '0 50px 90px -40px rgba(13,24,48,0.5), 0 2px 10px rgba(13,24,48,0.06)' }}>
        <KioskScreen width={SCREEN.width} highlight={current >= 2} pressed={press} />
      </div>
      <Rings x={TARGET.x} y={TARGET.y} beats={beats.filter((b) => b >= t[1]! && b < t[2]! + 40)} active={current >= 1 && current < 3} />
      <div style={{ position: 'absolute', left: fx - 26, top: fy - 26, width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,185,143,0.95)', boxShadow: '0 0 0 14px rgba(255,185,143,0.3), 0 10px 20px rgba(13,24,48,0.25)', transform: `scale(${1 - press * 0.3})` }} />
      {t.slice(0, 3).map((start, i) => <Sequence key={start} from={start} durationInFrames={90}><Audio src={staticFile(`sfx/tone-${i + 2}.wav`)} volume={0.45} /></Sequence>)}
      <Sequence from={t[2]!} durationInFrames={20}><Audio src={staticFile('sfx/buzz.wav')} volume={0.6} /></Sequence>
    </AbsoluteFill>
  );
};
