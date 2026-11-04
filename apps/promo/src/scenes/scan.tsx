import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { KioskScreen } from '../components/kiosk-screen.tsx';
import { outExpo, progress } from '../components/motion.ts';
import { copy } from '../copy.ts';
import { beatsWithin, sceneOf } from '../timeline.ts';
import { color, font, springs } from '../tokens.ts';

// Stage coordinates (1920 × 1080). The display sits inside the phone's screen once the phone has risen.
const DISPLAY = { x: 775, y: 168, w: 370 };
const DISPLAY_H = (DISPLAY.w / 600) * 800;
const PHONE = { x: 738, y: 96, w: 444, h: 1010, bezel: 13 };
// Phone cameras see wider than the eye: the camera view is the same scene zoomed out around the display's centre.
const LENS = 0.62;
const ORIGIN = { x: DISPLAY.x + DISPLAY.w / 2, y: DISPLAY.y + DISPLAY_H / 2 + 40 };
const lens = (x: number, y: number) => ({ x: ORIGIN.x + (x - ORIGIN.x) * LENS, y: ORIGIN.y + (y - ORIGIN.y) * LENS });

/** The shop around the kiosk: soft shelves and a floor, so the blurred background still reads as a place. */
const Backdrop: React.FC = () => (
  <AbsoluteFill style={{ background: `linear-gradient(180deg, ${color.day} 0%, #f6f8fc 62%, ${color.panel} 100%)` }}>
    {[[40, 250, 420, 520], [1460, 220, 420, 560]].map(([x, y, w, h]) => (
      <div key={x} style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 36, background: 'linear-gradient(180deg, #e9eef7, #dde5f2)' }}>
        {[0, 1, 2].map((r) => <div key={r} style={{ position: 'absolute', left: 24, right: 24, top: 60 + r * 160, height: 18, borderRadius: 9, background: '#cfd9ea' }} />)}
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} style={{ position: 'absolute', left: 36 + (i % 3) * 120, top: 10 + Math.floor(i / 3) * 160, width: 80, height: 48, borderRadius: 12, background: i % 2 ? '#ffe3cf' : '#dbe5ff' }} />)}
      </div>
    ))}
    <div style={{ position: 'absolute', left: 640, top: 990, width: 640, height: 60, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(13,24,48,0.22), rgba(13,24,48,0))' }} />
    {/* The self-checkout: a matte head unit, the display, a column and a base. Lit by gradients, no outlines. */}
    <div style={{ position: 'absolute', left: DISPLAY.x - 32, top: DISPLAY.y - 34, width: DISPLAY.w + 64, height: DISPLAY_H + 76, borderRadius: 34, background: 'linear-gradient(180deg, #f4f7fc, #dfe6f2)', boxShadow: '0 30px 60px -30px rgba(13,24,48,0.35)' }} />
    <div style={{ position: 'absolute', left: 880, top: DISPLAY.y + DISPLAY_H + 42, width: 160, height: 300, background: 'linear-gradient(90deg, #e9eef7, #cdd7e8)' }} />
    <div style={{ position: 'absolute', left: 790, top: 1004, width: 340, height: 26, borderRadius: 13, background: 'linear-gradient(180deg, #eef2f9, #d3dcec)' }} />
    <div style={{ position: 'absolute', left: DISPLAY.x, top: DISPLAY.y, borderRadius: 16, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(13,24,48,0.05), 0 2px 10px rgba(13,24,48,0.12)' }}>
      <KioskScreen width={DISPLAY.w} />
    </div>
  </AbsoluteFill>
);

const Bracket: React.FC<{ x: number; y: number; corner: number; scale: number }> = ({ x, y, corner, scale }) => {
  const top = corner < 2, left = corner % 2 === 0, s = 44;
  return <div style={{
    position: 'absolute', left: left ? x : x - s, top: top ? y : y - s, width: s, height: s,
    transform: `scale(${scale})`, transformOrigin: `${left ? 0 : 100}% ${top ? 0 : 100}%`,
    borderColor: color.peach, borderStyle: 'solid', borderWidth: 0,
    [top ? 'borderTopWidth' : 'borderBottomWidth']: 7, [left ? 'borderLeftWidth' : 'borderRightWidth']: 7,
    [`border${top ? 'Top' : 'Bottom'}${left ? 'Left' : 'Right'}Radius`]: 18,
  }} />;
};

/** Scene 3: the phone rises in front of the kiosk, focus racks to it, and its camera finds and locks onto the display. */
export const Scan: React.FC<{ duration?: number; beats?: number[] }> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = props.duration ?? sceneOf('scan').duration;
  const beats = props.beats ?? beatsWithin('scan');
  const riseAt = beats.find((b) => b >= 18) ?? 18;
  const lockAt = beats.find((b) => b >= duration * 0.5) ?? Math.round(duration * 0.5);
  const up = spring({ frame: frame - riseAt, fps, config: { damping: 16, mass: 1.1 } });
  const lock = spring({ frame: frame - lockAt, fps, config: springs.snappy });
  const blur = interpolate(frame, [riseAt + 10, riseAt + 50], [0, 9], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const push = interpolate(frame, [0, duration], [1, 1.07], { easing: outExpo });
  const bob = Math.sin(frame / 30) * 4 * up;
  const px = PHONE.x, py = PHONE.y + (1 - up) * 980 + bob;
  const sx = px + PHONE.bezel, sy = py + PHONE.bezel;
  const trace = progress(frame, lockAt - 50, 46);
  const scanY = interpolate(frame, [riseAt + 40, lockAt], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tl = lens(DISPLAY.x, DISPLAY.y), dw = DISPLAY.w * LENS, dh = DISPLAY_H * LENS;
  const perimeter = 2 * (dw + dh + 24);
  const found = frame >= lockAt;
  return (
    <AbsoluteFill style={{ background: color.day, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '50% 40%' }}>
        <AbsoluteFill style={{ filter: `blur(${blur}px)`, opacity: 1 - 0.08 * (blur / 9) }}><Backdrop /></AbsoluteFill>
        <div style={{ position: 'absolute', left: px, top: py, width: PHONE.w, height: PHONE.h, borderRadius: 72, background: 'linear-gradient(150deg, #2a3f70 0%, #0d1830 55%)', boxShadow: '0 60px 120px -40px rgba(13,24,48,0.6), 0 20px 40px -20px rgba(13,24,48,0.4)' }}>
          <div style={{ position: 'absolute', left: PHONE.bezel, top: PHONE.bezel, right: PHONE.bezel, bottom: PHONE.bezel, borderRadius: 60, overflow: 'hidden', background: `linear-gradient(180deg, ${color.day} 0%, #f6f8fc 55%, ${color.panel} 75%, ${color.panel} 100%)` }}>
            {/* The camera view: the same scene, sharp, seen through the phone. */}
            <div style={{ position: 'absolute', left: -sx, top: -sy, width: 1920, height: 1080, transform: `scale(${LENS})`, transformOrigin: `${ORIGIN.x}px ${ORIGIN.y}px`, filter: 'saturate(1.08) contrast(1.02)' }}><Backdrop /></div>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 50% 40%, transparent 60%, rgba(13,24,48,0.18) 100%)' }} />
            {scanY > 0 && !found ? <div style={{ position: 'absolute', left: 18, right: 18, top: `${14 + scanY * 46}%`, height: 4, borderRadius: 2, background: color.periwinkle, boxShadow: `0 0 24px ${color.periwinkle}`, opacity: 0.9 }} /> : null}
            <svg width={PHONE.w} height={PHONE.h} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden="true">
              <rect x={tl.x - sx - 12} y={tl.y - sy - 12} width={dw + 24} height={dh + 24} rx={18} fill="none" stroke={color.periwinkle} strokeWidth={4}
                strokeDasharray={perimeter} strokeDashoffset={perimeter * (1 - trace)} opacity={1 - 0.7 * lock} />
            </svg>
            {lock > 0.01 ? [0, 1, 2, 3].map((c) => (
              <Bracket key={c} corner={c} scale={1.35 - 0.35 * lock}
                x={tl.x - sx + (c % 2 ? dw + 20 : -20)} y={tl.y - sy + (c < 2 ? -20 : dh + 20)} />
            )) : null}
            <div style={{ position: 'absolute', left: '50%', top: 22, width: 128, height: 36, marginLeft: -64, borderRadius: 18, background: color.night }} />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 150, display: 'flex', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 26px', borderRadius: 999, background: 'rgba(13,24,48,0.88)', color: '#fff', fontFamily: font.body, fontWeight: 600, fontSize: 30, transform: `scale(${found ? 1 + 0.08 * (1 - lock) : 1})` }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: found ? color.peach : color.periwinkle }} />
                {found ? copy.scan : copy.framing}
              </div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
