import { useCurrentFrame } from 'remotion';
import { color, font, SAFE_WIDTH } from '../tokens.ts';
import { rise } from './motion.ts';

/** Burned-in caption. `speaker` tells the viewer who is talking, since the promo has no voice. */
export const Caption: React.FC<{ text: string; tone: 'day' | 'night'; appear: number; speaker?: 'fingerpost' | 'you'; bottom?: number }> = ({ text, tone, appear, speaker, bottom = 72 }) => {
  const frame = useCurrentFrame();
  const night = tone === 'night';
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom, display: 'flex', justifyContent: 'center', ...rise(frame, appear) }}>
      <div style={{
        maxWidth: SAFE_WIDTH, padding: '18px 30px', borderRadius: 26, textAlign: 'center', textWrap: 'balance',
        background: night ? 'rgba(27,44,85,0.92)' : 'rgba(13,24,48,0.92)', color: '#fff',
        fontFamily: font.body, fontWeight: 600, fontSize: 42, lineHeight: 1.25, display: 'flex', alignItems: 'center', gap: 18,
      }}>
        {speaker ? <span style={{ fontSize: 26, fontWeight: 600, color: speaker === 'you' ? color.peach : color.periwinkle, whiteSpace: 'nowrap' }}>{speaker === 'you' ? 'You' : 'Fingerpost'}</span> : null}
        <span>{text}</span>
      </div>
    </div>
  );
};
