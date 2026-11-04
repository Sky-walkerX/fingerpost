import { useCurrentFrame } from 'remotion';
import { color } from '../tokens.ts';

/** Sound rings closing in on the target, one per beat. */
export const Rings: React.FC<{ x: number; y: number; beats: number[]; active: boolean }> = ({ x, y, beats, active }) => {
  const frame = useCurrentFrame();
  if (!active) return null;
  return (
    <>
      {beats.filter((b) => frame >= b && frame < b + 36).map((b) => {
        const p = (frame - b) / 36;
        const r = 220 * (1 - p) + 50;
        return <div key={b} style={{ position: 'absolute', left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: '50%', border: `4px solid ${color.periwinkle}`, opacity: 0.9 * Math.sin(Math.PI * p) }} />;
      })}
    </>
  );
};
