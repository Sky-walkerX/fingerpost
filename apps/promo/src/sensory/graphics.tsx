import { interpolate, spring, useCurrentFrame } from 'remotion';
import { color, font } from '../tokens.ts';

export const ramp = (f: number, at: number, duration = 24) => interpolate(f, [at, at + duration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
export const smooth = (f: number, at: number, duration = 36) => {
  const p = ramp(f, at, duration);
  return p * p * (3 - 2 * p);
};
export const pop = (f: number, at = 0, damping = 19) => spring({ frame: f - at, fps: 60, config: { damping, stiffness: 155, mass: 0.85 } });

export const RevealText: React.FC<{ children: React.ReactNode; at?: number; size?: number; ink?: string; serif?: boolean; style?: React.CSSProperties }> = ({ children, at = 0, size = 100, ink = '#fff', serif = false, style }) => {
  const f = useCurrentFrame();
  const p = pop(f, at);
  return <div style={{ overflow: 'hidden', paddingBottom: '0.14em', marginBottom: '-0.14em', ...style }}><div style={{ fontFamily: serif ? font.display : font.body, fontWeight: serif ? 400 : 750, fontSize: size, lineHeight: 1.02, letterSpacing: serif ? '-0.025em' : '-0.055em', color: ink,
    transform: `translateY(${(1 - p) * 115}%) rotate(${(1 - p) * 3}deg)`, transformOrigin: 'left bottom', opacity: ramp(f, at, 8) }}>{children}</div></div>;
};

export const Chapter: React.FC<{ number: string; text: string; light?: boolean; tag?: string }> = ({ number, text, light = false, tag }) => <div style={{ position: 'absolute', left: 88, right: 88, top: 58, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: font.body, fontSize: 25, fontWeight: 650, letterSpacing: '0.1em', color: light ? color.muted : color.nightText, zIndex: 20 }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}><span style={{ color: light ? color.blue : color.peach }}>{number}</span><span style={{ width: 48, height: 1, background: 'currentColor', opacity: 0.6 }} /><span>{text}</span></div>
  {tag ? <span style={{ fontSize: 23, letterSpacing: '0.025em', borderRadius: 99, padding: '11px 18px', background: light ? 'rgba(47,95,214,0.07)' : 'rgba(13,24,48,0.85)', color: light ? color.blue : color.periwinkle }}>{tag}</span> : <span style={{ letterSpacing: '-0.025em' }}>Fingerpost</span>}
</div>;

export const Grid: React.FC<{ light?: boolean }> = ({ light = false }) => <div style={{ position: 'absolute', inset: 0, opacity: light ? 0.045 : 0.055, backgroundImage: `linear-gradient(${light ? color.ink : '#fff'} 1px,transparent 1px),linear-gradient(90deg,${light ? color.ink : '#fff'} 1px,transparent 1px)`, backgroundSize: '120px 120px', backgroundPosition: '0 -1px' }} />;

export const Ring: React.FC<{ size?: number; progress?: number; pulse?: number; blue?: boolean }> = ({ size = 280, progress = 1, pulse = 0, blue = true }) => <svg width={size} height={size} viewBox="0 0 300 300" style={{ overflow: 'visible' }}>
  {blue ? <circle cx="150" cy="150" r="145" fill={color.blue} /> : null}
  <circle cx="150" cy="150" r="95" fill="none" stroke={color.periwinkle} strokeWidth="16" strokeDasharray={2 * Math.PI * 95} strokeDashoffset={2 * Math.PI * 95 * (1 - progress)} transform="rotate(-90 150 150)" />
  <circle cx="150" cy="150" r={47.5 + pulse * 5} fill={color.peach} />
</svg>;

export const Icon: React.FC<{ name: 'voice' | 'tone' | 'haptic' | 'cloud' | 'mic' | 'lock' | 'check' | 'arrow'; size?: number; stroke?: string; off?: number }> = ({ name, size = 80, stroke = 'currentColor', off = 0 }) => {
  const paths: Record<typeof name, React.ReactNode> = {
    voice: <><path d="M9 8 5 11H2v10h3l4 3V8z" /><path d="M15 9c5 3 5 11 0 14M20 5c9 6 9 17 0 23" /></>,
    tone: <path d="M2 16h3l3-10 4 22 4-25 4 24 4-18 3 7h3" />,
    haptic: <><rect x="10" y="4" width="12" height="24" rx="3" /><path d="m5 10-3 6 3 6m22-12 3 6-3 6" /></>,
    cloud: <><path d="M8 25h17a6 6 0 0 0 0-12 9 9 0 0 0-17-3 7.5 7.5 0 0 0 0 15z" /><path d="M16 22V12m-4 4 4-4 4 4" /></>,
    mic: <><rect x="12" y="3" width="8" height="16" rx="4" /><path d="M7 14a9 9 0 0 0 18 0m-9 9v6m-5 0h10" /></>,
    lock: <><rect x="6" y="13" width="20" height="16" rx="4" /><path d="M10 13V9a6 6 0 0 1 12 0v4m-6 7v3" /></>,
    check: <path d="m5 16 7 7L28 7" />,
    arrow: <path d="M3 16h25m-9-9 9 9-9 9" />,
  };
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[name]}{off > 0 ? <path d="m3 3 26 26" stroke={color.peach} strokeWidth="3.5" strokeDasharray="40" strokeDashoffset={40 * (1 - off)} /> : null}</svg>;
};

export const MiniWave: React.FC<{ frame: number; active?: boolean; ink?: string; width?: number }> = ({ frame, active = true, ink = color.periwinkle, width = 420 }) => <svg width={width} height="120" viewBox="0 0 420 120">
  {Array.from({ length: 46 }, (_, i) => {
    const e = Math.sin((i + 0.5) / 46 * Math.PI);
    const h = active ? 6 + 76 * e * (0.35 + 0.65 * Math.abs(Math.sin(i * 1.37 + frame * 0.14))) : 5;
    return <rect key={i} x={i * 9 + 4} y={(120 - h) / 2} width="4" height={h} rx="2" fill={ink} />;
  })}
</svg>;

export const GlassesDrawing: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = smooth(frame, 0, 70);
  const turn = smooth(frame, 90, 150);
  return <div style={{ transform: `perspective(1500px) rotateY(${-18 + turn * 24}deg) rotateX(${7 - turn * 5}deg) rotateZ(${-7 + turn * 7}deg)`, transformStyle: 'preserve-3d' }}>
    <svg width="1090" height="410" viewBox="0 0 1090 410" style={{ overflow: 'visible' }}>
      <defs><linearGradient id="sensory-lens" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a9c1ff" stopOpacity="0.20" /><stop offset="0.55" stopColor="#0d1830" stopOpacity="0.03" /><stop offset="1" stopColor="#2f5fd6" stopOpacity="0.2" /></linearGradient></defs>
      <path d="M95 149 20 60 107 36 243 131M994 149 1060 50 991 25 848 128" fill="none" stroke="#6b83b0" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" opacity={draw * 0.8} />
      <path d="M92 140Q76 140 78 163L96 270Q104 333 171 338H363Q431 332 439 267L452 172Q455 140 425 140ZM665 140Q635 140 638 172L651 267Q659 332 727 338H919Q986 333 994 270L1012 163Q1014 140 998 140Z" fill="url(#sensory-lens)" stroke="#ecf2ff" strokeWidth="21" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - draw} />
      <path d="M452 178Q545 133 638 178M76 142 25 112M1015 143l48-41" fill="none" stroke="#ecf2ff" strokeWidth="22" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - draw} />
      <circle cx="113" cy="173" r="17" fill={color.night} stroke={color.peach} strokeWidth="5" opacity={draw} />
      <circle cx="113" cy="173" r="5" fill={color.peach} opacity={draw} />
      <path d="m148 169 215 0m335 0h216" stroke="#fff" strokeWidth="3" opacity={0.25 * draw} />
    </svg>
  </div>;
};
