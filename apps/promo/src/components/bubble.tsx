import { useCurrentFrame } from 'remotion';
import { color, font } from '../tokens.ts';
import { rise } from './motion.ts';
import { Waveform } from './waveform.tsx';

/** One turn of the spoken exchange, shown as text because the promo has no voice. */
export const Bubble: React.FC<{ who: 'you' | 'fingerpost'; text: string; at: number; speaking?: [number, number] }> = ({ who, text, at, speaking }) => {
  const frame = useCurrentFrame();
  const you = who === 'you';
  const talking = speaking ? frame >= speaking[0] && frame < speaking[1] : false;
  return (
    <div style={{ ...rise(frame, at), display: 'flex', flexDirection: 'column', alignItems: you ? 'flex-end' : 'flex-start', gap: 10 }}>
      <div style={{ fontFamily: font.body, fontWeight: 600, fontSize: 26, color: you ? '#9a4a1e' : color.blue }}>{you ? 'You' : 'Fingerpost'}</div>
      <div style={{
        maxWidth: 820, padding: '24px 32px', borderRadius: 30, fontFamily: font.body, fontWeight: 600, fontSize: 44, lineHeight: 1.25,
        background: you ? '#fff1e6' : color.night, color: you ? color.ink : '#fff', display: 'flex', alignItems: 'center', gap: 22,
        borderBottomRightRadius: you ? 8 : 30, borderBottomLeftRadius: you ? 30 : 8,
      }}>
        {speaking ? <Waveform active={talking} bars={12} /> : null}
        <span>{text}</span>
      </div>
    </div>
  );
};
