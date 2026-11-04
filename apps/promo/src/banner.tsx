import { AbsoluteFill } from 'remotion';
import { BrandMark } from './components/brand-mark.tsx';
import { useFontsReady } from './fonts.ts';
import { color, font } from './tokens.ts';

export const BANNER = { width: 1600, height: 480 } as const;

/** One kiosk button on the banner's illustrated screen. */
const Key: React.FC<{ x: number; y: number; w: number; label: string; target?: boolean }> = ({ x, y, w, label, target }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: 64, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: target ? color.peach : 'rgba(255,255,255,0.08)', color: target ? color.ink : color.nightText,
    fontFamily: font.body, fontWeight: 700, fontSize: 24,
    boxShadow: target ? `0 0 0 5px ${color.night}, 0 0 0 9px ${color.peach}` : 'none' }}>{label}</div>
);

/** README banner: the wordmark on the left, a touchscreen with a guided fingertip on the right. */
export const Banner: React.FC = () => {
  useFontsReady();
  const target = { x: 1220, y: 298 }; // centre of the Add to order key
  return (
    <AbsoluteFill style={{ background: `radial-gradient(900px 520px at 78% 50%, ${color.raised} 0%, ${color.night} 70%)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 110, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22, width: 760 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          <BrandMark size={96} />
          <div style={{ fontFamily: font.display, fontSize: 124, lineHeight: 1, color: '#fff', letterSpacing: '-0.01em' }}>Fingerpost</div>
        </div>
        <div style={{ fontFamily: font.body, fontWeight: 500, fontSize: 36, lineHeight: 1.3, color: color.nightText }}>
          Guides a blind person’s finger to the right spot on any touchscreen.
        </div>
        <div style={{ fontFamily: font.body, fontWeight: 600, fontSize: 24, color: color.periwinkle }}>Built with Meta’s models. Free and open source.</div>
      </div>
      {/* The illustrated kiosk: a flat screen of buttons, one of them the target. */}
      <div style={{ position: 'absolute', left: 960, top: 70, width: 520, height: 340, borderRadius: 34, background: 'rgba(255,255,255,0.05)',
        boxShadow: 'inset 0 0 0 2px rgba(169,193,255,0.18)' }}>
        <div style={{ position: 'absolute', left: 32, top: 28, fontFamily: font.body, fontWeight: 700, fontSize: 26, color: '#fff' }}>Choose a size</div>
        <Key x={32} y={90} w={140} label="Small" />
        <Key x={190} y={90} w={140} label="Medium" />
        <Key x={348} y={90} w={140} label="Large" />
        <Key x={122} y={196} w={276} label="Add to order" target />
      </div>
      {/* Guidance rings narrowing onto the target, and the fingertip on its way in. */}
      <svg width={BANNER.width} height={BANNER.height} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
        {[150, 112, 78].map((r, i) => (
          <circle key={r} cx={target.x} cy={target.y} r={r} fill="none" stroke={color.periwinkle} strokeWidth={3} opacity={0.16 + i * 0.12} />
        ))}
        <path d={`M ${target.x + 170} ${target.y + 150} Q ${target.x + 110} ${target.y + 92} ${target.x + 40} ${target.y + 46}`} fill="none"
          stroke={color.periwinkle} strokeWidth={3} strokeDasharray="2 12" strokeLinecap="round" opacity={0.7} />
        <circle cx={target.x + 22} cy={target.y + 30} r={22} fill="none" stroke="#fff" strokeWidth={5} />
        <circle cx={target.x + 22} cy={target.y + 30} r={9} fill="#fff" />
      </svg>
    </AbsoluteFill>
  );
};
