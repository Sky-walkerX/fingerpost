import { useCurrentFrame } from 'remotion';
import { color, font } from '../tokens.ts';
import { rise } from './motion.ts';

/** Large serif statement lines that land one by one; the second line is italic. */
export const Statement: React.FC<{ lines: readonly string[]; at: readonly number[]; tone: 'day' | 'night'; size?: number; accentLast?: boolean }> = ({ lines, at, tone, size = 170, accentLast = false }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ fontFamily: font.display, fontSize: size, lineHeight: 1.02, letterSpacing: '-0.01em' }}>
      {lines.map((line, i) => (
        <div key={line} style={{
          ...rise(frame, at[i] ?? 0),
          fontStyle: i === 1 ? 'italic' : 'normal',
          color: accentLast && i === lines.length - 1 ? (tone === 'day' ? color.blue : color.periwinkle) : tone === 'day' ? color.ink : '#ffffff',
        }}>{line}</div>
      ))}
    </div>
  );
};
