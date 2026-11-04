import { useCurrentFrame } from 'remotion';
import { font, SAFE_WIDTH } from '../tokens.ts';
import { sentenceTimes } from './timeline.ts';

/** Burned-in subtitles for the narration, one sentence at a time. */
export const Subtitles: React.FC<{ id: string; voAt: number }> = ({ id, voAt }) => {
  const frame = useCurrentFrame() - voAt;
  const lines = sentenceTimes(id);
  const current = [...lines].reverse().find((l) => frame >= l.at);
  if (!current) return null;
  const fade = Math.min(1, (frame - current.at) / 6);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 22, display: 'flex', justifyContent: 'center', opacity: fade }}>
      <div style={{ maxWidth: SAFE_WIDTH, padding: '10px 22px', borderRadius: 14, background: 'rgba(13,24,48,0.78)', color: '#fff', fontFamily: font.body, fontWeight: 500, fontSize: 32, lineHeight: 1.3, textAlign: 'center', textWrap: 'balance' }}>{current.text}</div>
    </div>
  );
};
