import { random, useCurrentFrame } from 'remotion';
import { color } from '../tokens.ts';

/** Voice bars: alive while `active`, settled otherwise. Seeded, so every render is identical. */
export const Waveform: React.FC<{ active: boolean; bars?: number; tone?: string }> = ({ active, bars = 18, tone = color.peach }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 54 }}>
      {Array.from({ length: bars }, (_, i) => {
        const wobble = 0.5 + 0.5 * Math.sin(frame / (3 + random(`w${i}`) * 4) + random(`p${i}`) * 6);
        const h = active ? 10 + wobble * (20 + random(`a${i}`) * 34) : 8;
        return <span key={i} style={{ width: 7, height: h, borderRadius: 4, background: tone, opacity: active ? 1 : 0.4 }} />;
      })}
    </div>
  );
};
