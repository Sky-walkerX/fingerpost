import { useCurrentFrame } from 'remotion';
import { color } from '../tokens.ts';

/** The rising guidance tone drawn as a wave: faster and taller as `level` goes 0 → 1, like the landing page. */
export const ToneLine: React.FC<{ level: number; width: number; height: number }> = ({ level, width, height }) => {
  const frame = useCurrentFrame();
  const mid = height / 2;
  let d = '';
  for (let x = 0; x <= width; x += 4) {
    const u = x / width;
    const freq = 4 + (6 + level * 30) * u * u;
    const amp = (0.12 + 0.62 * u * (0.35 + level * 0.65)) * mid;
    const y = mid + Math.sin(u * freq * Math.PI * 2 - frame * (0.03 + level * 0.1)) * amp;
    d += `${x === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }} aria-hidden="true">
      <defs><linearGradient id="tone-g" x1="0" x2="1"><stop offset="0" stopColor="#b9c6de" /><stop offset="0.55" stopColor="#7f9be6" /><stop offset="1" stopColor={color.blue} /></linearGradient></defs>
      <path d={d} fill="none" stroke="url(#tone-g)" strokeWidth={5} strokeLinecap="round" />
    </svg>
  );
};
