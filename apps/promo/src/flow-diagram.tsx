import { AbsoluteFill } from 'remotion';
import { useFontsReady } from './fonts.ts';
import { color, font } from './tokens.ts';

export const FLOW = { width: 1920, height: 640 } as const;

const W = 250, H = 170;
const COL = [40, 435, 830, 1225, 1620] as const;
const ROW = [90, 400] as const;
type Col = 0 | 1 | 2 | 3 | 4;
type Row = 0 | 1;
type Tone = 'night' | 'gate' | 'meta' | 'light';
const TONES: Record<Tone, { bg: string; title: string; sub: string; ring: string }> = {
  night: { bg: color.raised, title: '#fff', sub: color.nightText, ring: 'rgba(169,193,255,0.35)' },
  gate: { bg: color.peach, title: color.ink, sub: color.ink, ring: 'transparent' },
  meta: { bg: color.blue, title: '#fff', sub: '#e4ecff', ring: 'rgba(169,193,255,0.5)' },
  light: { bg: color.panel, title: color.ink, sub: color.muted, ring: 'transparent' },
};

const Card: React.FC<{ col: Col; row: Row; title: string; sub: string; tone: Tone }> = ({ col, row, title, sub, tone }) => {
  const t = TONES[tone];
  return (
    <div style={{ position: 'absolute', left: COL[col], top: ROW[row], width: W, height: H, borderRadius: 24, background: t.bg,
      boxShadow: `inset 0 0 0 2px ${t.ring}`, padding: '22px 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontFamily: font.body, fontWeight: 700, fontSize: 25, color: t.title }}>{title}</div>
      <div style={{ fontFamily: font.body, fontWeight: 500, fontSize: 19, lineHeight: 1.3, color: t.sub }}>{sub}</div>
    </div>
  );
};

const Label: React.FC<{ x: number; y: number; text: string }> = ({ x, y, text }) => (
  <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', padding: '5px 12px', borderRadius: 999,
    background: color.night, color: color.periwinkle, fontFamily: font.body, fontWeight: 600, fontSize: 17, whiteSpace: 'nowrap' }}>{text}</div>
);

/** README "How it works" diagram, in the promo's style: one request, read, guided and pressed. */
export const FlowDiagram: React.FC = () => {
  useFontsReady();
  const cy = (row: Row) => ROW[row] + H / 2;
  const right = (col: Col) => COL[col] + W, left = (col: Col) => COL[col];
  const mid = (a: number, b: number) => (a + b) / 2;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1100px 520px at 50% 40%, #13224a 0%, ${color.night} 75%)` }}>
      {/* Everything inside this frame runs on the phone. */}
      <div style={{ position: 'absolute', left: COL[1] - 22, top: 46, width: COL[2] + W - COL[1] + 44, height: 554, borderRadius: 34,
        boxShadow: 'inset 0 0 0 2px rgba(169,193,255,0.22)', background: 'rgba(169,193,255,0.04)' }} />
      <div style={{ position: 'absolute', left: COL[1], top: 58, fontFamily: font.body, fontWeight: 600, fontSize: 18, color: color.periwinkle }}>On the phone</div>
      <svg width={FLOW.width} height={FLOW.height} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
        <defs>
          <marker id="head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color.periwinkle} />
          </marker>
        </defs>
        <g stroke={color.periwinkle} strokeWidth={3} fill="none" strokeLinecap="round">
          <line x1={right(0) + 8} y1={cy(0)} x2={left(1) - 10} y2={cy(0)} markerEnd="url(#head)" />
          <line x1={right(1) + 8} y1={cy(0)} x2={left(2) - 10} y2={cy(0)} markerEnd="url(#head)" />
          <line x1={right(2) + 8} y1={cy(0)} x2={left(3) - 10} y2={cy(0)} markerEnd="url(#head)" />
          <line x1={right(3) + 12} y1={cy(0)} x2={left(4) - 12} y2={cy(0)} markerStart="url(#head)" markerEnd="url(#head)" />
          <path d={`M ${COL[3] + W / 2} ${ROW[0] + H + 8} V ${cy(1)} H ${right(1) + 12}`} markerEnd="url(#head)" />
          <line x1={left(1) - 8} y1={cy(1)} x2={right(0) + 10} y2={cy(1)} markerEnd="url(#head)" />
        </g>
      </svg>
      <Card col={0} row={0} tone="light" title="You say" sub="“Order a medium cola”" />
      <Card col={1} row={0} tone="night" title="Phone camera" sub="Tracks your fingertip and reads text on the device" />
      <Card col={2} row={0} tone="gate" title="PIN and payment gate" sub="Nothing leaves the phone during a PIN pad" />
      <Card col={3} row={0} tone="night" title="Fingerpost gateway" sub="Task agent and safety policy" />
      <Card col={4} row={0} tone="meta" title="Meta models" sub="Voice Transcribe, Muse Wonder or Spark, SAM 3.1" />
      <Card col={1} row={1} tone="night" title="Guidance" sub="Tones, short directions and vibration" />
      <Card col={0} row={1} tone="light" title="Your finger" sub="lands on the right button" />
      <Label x={mid(right(0), left(1))} y={cy(0) - 30} text="speech" />
      <Label x={mid(right(2), left(3))} y={cy(0) - 30} text="safe frames" />
      <Label x={mid(right(3), left(4))} y={cy(0) - 30} text="read, plan" />
      <Label x={mid(right(1), COL[3] + W / 2)} y={cy(1) - 28} text="the target" />
      <Label x={mid(right(0), left(1))} y={cy(1) - 30} text="guided" />
    </AbsoluteFill>
  );
};
