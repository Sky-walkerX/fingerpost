import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { rise } from '../../components/motion.ts';
import { color, font } from '../../tokens.ts';
import { cue } from '../cue.ts';

const ICON: Record<string, string> = {
  talkback: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-1 5h2v5h-2zm0 7h2v2h-2z',
  lang: 'M3 5h10M8 3v2m-3 0c1 4 4 7 8 8M11 5c-1 4-4 7-8 8m10 6 4-9 4 9m-7-3h6',
  vibe: 'M8 3h8v18H8zM4 8v8M20 8v8M1 10v4M23 10v4',
  offline: 'M2 8a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M3 3l18 18',
  home: 'M3 11 12 4l9 7v9H3zM9 20v-6h6v6',
};
const TILES = [
  ['works with TalkBack', 'talkback', 'Works with TalkBack', 'Or on its own, with its own voice.'],
  ['English, Hindi and Spanish', 'lang', 'English · हिन्दी · Español', 'Guidance in three languages.'],
  ['vibration-only mode', 'vibe', 'Vibration only', 'Directions by pattern, for deafblind users.'],
  ['basic offline mode', 'offline', 'Offline basic mode', 'Text buttons, with no signal at all.'],
  ['remembers the appliances', 'home', 'My devices', 'Your microwave and washer, remembered.'],
] as const;

/** Who it works for, each tile landing as it is said. */
export const Everyone: React.FC = () => {
  const frame = useCurrentFrame();
  const c = cue('everyone');
  return (
    <AbsoluteFill style={{ background: color.day }}>
      <div style={{ position: 'absolute', left: 130, top: 110, fontFamily: font.display, fontSize: 104, color: color.ink, ...rise(frame, c.voAt) }}>Built for everyone who needs it.</div>
      <div style={{ position: 'absolute', left: 130, right: 130, top: 330, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 30 }}>
        {TILES.map(([phrase, icon, title, line]) => (
          <div key={title} style={{ ...rise(frame, c.at(phrase)), padding: 34, borderRadius: 32, background: color.panel, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 250 }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={color.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[icon]} /></svg>
            <div style={{ fontFamily: font.body, fontWeight: 700, fontSize: 42, color: color.ink }}>{title}</div>
            <div style={{ fontFamily: font.body, fontWeight: 500, fontSize: 30, color: color.muted }}>{line}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
