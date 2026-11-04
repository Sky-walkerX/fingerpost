import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption } from '../components/caption.tsx';
import { progress, rise } from '../components/motion.ts';
import { Statement } from '../components/statement.tsx';
import { Wipe } from '../components/wipe.tsx';
import { appQuote, copy } from '../copy.ts';
import { beatsWithin } from '../timeline.ts';
import { color, font, springs } from '../tokens.ts';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''];
const PHONE = { x: 1215, y: 190 }, CLOUD = { x: 1760, y: 150 };

/** Scene 6: a PIN pad appears, uploads visibly stop and the microphone turns off. Nothing leaves the phone. */
export const Privacy: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beats = beatsWithin('privacy');
  const at = (min: number) => beats.find((b) => b >= min) ?? min;
  const padIn = at(24), detect = at(padIn + 90), headline = at(detect + 40);
  const pad = spring({ frame: frame - padIn, fps, config: springs.snappy });
  const cut = progress(frame, detect, 18);
  // After detection, keys light as if pressed; the entry field never shows a digit.
  const pressedKey = frame > detect + 30 ? Math.floor(random(`key-${Math.floor((frame - detect) / 24)}`) * 10) : -1;
  const pressPhase = ((frame - detect) % 24) / 24;
  const entered = frame > detect + 30 ? Math.min(4, Math.floor((frame - detect - 30) / 24) + 1) : 0;
  const dots = Array.from({ length: 9 }, (_, i) => {
    const u = ((frame / 40 + i / 9) % 1);
    return { u, x: PHONE.x + (CLOUD.x - PHONE.x) * u, y: PHONE.y + (CLOUD.y - PHONE.y) * u - Math.sin(Math.PI * u) * 80 };
  });
  return (
    <AbsoluteFill style={{ background: color.day }}>
      <Wipe to="night">
        <AbsoluteFill style={{ background: `radial-gradient(60% 70% at 70% 50%, ${color.raised} 0%, ${color.night} 72%)` }}>
          <div style={{ position: 'absolute', left: 130, top: 250 }}>
            <Statement lines={copy.privacy.headline} at={[headline, headline + 14]} tone="night" size={118} accentLast />
          </div>
          <div style={{ position: 'absolute', left: 130, top: 560, ...rise(frame, detect + 6), display: 'inline-flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderRadius: 999, background: 'rgba(255,185,143,0.14)', color: color.peach, fontFamily: font.body, fontWeight: 600, fontSize: 34 }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: color.peach }} />{copy.privacy.chip}
          </div>
          {dots.map((d, i) => (
            <div key={i} style={{ position: 'absolute', left: d.x - 7, top: d.y - 7, width: 14, height: 14, borderRadius: '50%', background: color.periwinkle, opacity: (1 - cut) * Math.sin(Math.PI * d.u) * (frame > padIn - 30 ? 1 : 0) }} />
          ))}
          <svg width="150" height="100" viewBox="0 0 150 100" style={{ position: 'absolute', left: CLOUD.x - 75, top: CLOUD.y - 50, opacity: 1 - 0.65 * cut }} aria-hidden="true">
            <path d="M40 85 h75 a28 28 0 0 0 0 -56 a40 40 0 0 0 -76 -6 a30 30 0 0 0 1 62z" fill="none" stroke={color.nightText} strokeWidth="6" strokeLinejoin="round" />
            <line x1="20" y1="92" x2={20 + 112 * cut} y2={92 - 86 * cut} stroke={color.peach} strokeWidth="7" strokeLinecap="round" />
          </svg>
          <div style={{ position: 'absolute', left: PHONE.x - 70, top: PHONE.y - 115, width: 140, height: 230, borderRadius: 28, background: '#1f3260', boxShadow: '0 30px 60px -20px rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center' }}>
            <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke={cut > 0.5 ? color.peach : color.nightText} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              <line x1="4" y1="4" x2={4 + 16 * cut} y2={4 + 16 * cut} stroke={color.peach} />
            </svg>
          </div>
          <div style={{ position: 'absolute', left: 1290, top: 340, padding: 34, borderRadius: 44, background: color.raised, boxShadow: '0 50px 90px -40px rgba(0,0,0,0.6)', transform: `translateY(${(1 - pad) * 120}px) scale(${0.9 + 0.1 * pad})`, opacity: pad }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginBottom: 26 }}>
              {[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 22, height: 22, borderRadius: '50%', border: `3px solid ${color.nightText}`, background: i < entered ? color.nightText : 'transparent', opacity: 0.7 }} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 104px)', gap: 16 }}>
              {KEYS.map((k, i) => <div key={i} style={{ height: 96, borderRadius: 24, background: k ? (KEYS.filter(Boolean).indexOf(k) === pressedKey && pressPhase < 0.5 ? '#3d5a9e' : '#24365e') : 'transparent', color: '#9fb0d1', fontFamily: font.body, fontWeight: 600, fontSize: 40, display: 'grid', placeItems: 'center', transform: `scale(${interpolate(spring({ frame: frame - padIn - i * 2, fps, config: springs.snappy }), [0, 1], [0.6, 1])})` }}>{k}</div>)}
            </div>
          </div>
          <Caption text={appQuote.pinPad} tone="night" appear={detect + 10} speaker="fingerpost" />
        </AbsoluteFill>
      </Wipe>
    </AbsoluteFill>
  );
};
