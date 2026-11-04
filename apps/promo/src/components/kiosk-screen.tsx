import { color, font } from '../tokens.ts';

const ITEMS = [['Sparkling water', '1.80'], ['Rye bread', '3.40'], ['Apples, 1 kg', '7.20']] as const;
export const KIOSK_TOTAL = '12.40';

/** The fictional, unbranded self-checkout screen. Drawn at 600 × 800 and scaled to `width`. */
export const KioskScreen: React.FC<{ width: number; highlight?: boolean; pressed?: number; dim?: number; totalGlow?: number }> = ({ width, highlight = false, pressed = 0, dim = 0, totalGlow = 0 }) => {
  const s = width / 600;
  return (
    <div style={{ width, height: 800 * s, overflow: 'hidden', position: 'relative' }}>
      <div style={{ width: 600, height: 800, transform: `scale(${s})`, transformOrigin: '0 0', background: color.day, fontFamily: font.body, color: color.ink, padding: '44px 44px 40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontSize: 40, fontWeight: 700 }}>Your basket</div>
          <div style={{ fontSize: 24, color: color.muted, fontWeight: 500 }}>3 items</div>
        </div>
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {ITEMS.map(([name, price]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: color.panel, borderRadius: 20, padding: '22px 24px', fontSize: 28, fontWeight: 500 }}>
              <span>{name}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{price}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'auto', marginBottom: 22, display: 'flex', justifyContent: 'space-between', fontSize: 36, fontWeight: 700, padding: '10px 14px', borderRadius: 16, background: `rgba(255,185,143,${0.45 * totalGlow})` }}>
          <span>Total</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{KIOSK_TOTAL}</span>
        </div>
        <div style={{
          position: 'relative', borderRadius: 28, padding: '34px 0', textAlign: 'center', fontSize: 40, fontWeight: 700,
          background: color.blue, color: '#fff', transform: `scale(${1 - 0.06 * pressed})`,
          boxShadow: highlight ? `0 0 0 ${8 + 4 * pressed}px rgba(255,185,143,0.9)` : '0 18px 30px -18px rgba(47,95,214,0.8)',
        }}>Pay by card</div>
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 24, color: color.muted, fontWeight: 500 }}>Need help? Ask a member of staff</div>
      </div>
      {dim > 0 ? <div style={{ position: 'absolute', inset: 0, background: `rgba(13,24,48,${dim})` }} /> : null}
    </div>
  );
};
