import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { color, font } from '../../tokens.ts';
import demo from '../demo.json' with { type: 'json' };

/** The one-minute live demo slot. Set `file` in demo.json (a path under public/) to drop the recording in. */
export const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  if (demo.file) return <OffthreadVideo src={staticFile(demo.file)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  const pulse = 0.5 + 0.5 * Math.sin(frame / 20);
  return (
    <AbsoluteFill style={{ background: color.night, justifyContent: 'center', alignItems: 'center', gap: 30 }}>
      <div style={{ width: 120, height: 120, borderRadius: '50%', border: `4px solid ${color.periwinkle}`, opacity: 0.4 + 0.6 * pulse, transform: `scale(${0.9 + 0.1 * pulse})` }} />
      <div style={{ fontFamily: font.display, fontSize: 120, color: '#fff' }}>Live demo</div>
      <div style={{ fontFamily: font.body, fontWeight: 500, fontSize: 36, color: color.nightText }}>Recording goes here (60 s)</div>
    </AbsoluteFill>
  );
};
