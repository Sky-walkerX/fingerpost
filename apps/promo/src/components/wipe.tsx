import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { color } from '../tokens.ts';
import { progress, wipeEase } from './motion.ts';

/** A horizontal day/night wipe: the new ground sweeps in from the left over 20 frames. */
export const Wipe: React.FC<{ start?: number; to: 'day' | 'night'; children?: React.ReactNode }> = ({ start = 0, to, children }) => {
  const frame = useCurrentFrame();
  const p = progress(frame, start, 20, wipeEase);
  return (
    <AbsoluteFill style={{ clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`, background: to === 'day' ? color.day : color.night }}>
      {children}
    </AbsoluteFill>
  );
};
