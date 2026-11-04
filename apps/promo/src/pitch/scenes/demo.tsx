import { AbsoluteFill, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { color, font } from '../../tokens.ts';
import demo from '../demo.json' with { type: 'json' };

/** Step captions for the recorded take, in clip seconds. They describe only what the screen shows. */
const STEPS: ReadonlyArray<[number, string]> = [
  [0, 'You say what you want: “Start order.”'],
  [5.1, 'Fingerpost reads the kiosk and finds the button.'],
  [5.6, 'Tones and spoken directions guide the finger to it.'],
  [16.5, 'It sees the press, then checks that the screen changed.'],
  [25.5, 'Done. The next screen is open.'],
  [27.7, 'Next: “Press Classic Burger.”'],
  [33.8, 'Found the Classic Burger. Guiding the finger.'],
  [42.2, 'Press detected. Checking the screen.'],
  [48.2, 'The burger’s page opened.'],
  [59.2, 'Done.'],
];
/** Where the two takes join, and how much time the cut skips. */
const CUT_AT = 27.7, SKIPPED_S = 37;

/** The one-minute live demo slot. Set `file` in demo.json (a path under public/) to drop the recording in. */
export const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (demo.file) {
    const t = frame / fps;
    const index = STEPS.findLastIndex(([at]) => t >= at);
    const [at, text] = STEPS[Math.max(0, index)]!;
    const fadeIn = interpolate(t - at, [0, 0.35], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const skip = interpolate(t - CUT_AT, [0, 0.3, 2.6, 3.1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return (
      <AbsoluteFill style={{ background: color.night }}>
        <OffthreadVideo src={staticFile(demo.file)} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 824 }} />
        <div style={{ position: 'absolute', right: 36, top: 32, padding: '14px 24px', borderRadius: 999, background: 'rgba(13,24,48,0.82)',
          color: '#fff', fontFamily: font.body, fontWeight: 600, fontSize: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: color.peach }} />
          Live on a phone, real Meta models
        </div>
        {skip > 0 ? (
          <div style={{ position: 'absolute', left: '50%', top: 360, transform: `translateX(-50%) scale(${0.96 + 0.04 * skip})`, opacity: skip,
            padding: '22px 40px', borderRadius: 24, background: 'rgba(13,24,48,0.9)', color: '#fff', fontFamily: font.body, fontWeight: 700, fontSize: 44 }}>
            {SKIPPED_S} seconds later
          </div>
        ) : null}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 824, bottom: 0, display: 'flex', alignItems: 'center', padding: '0 120px', gap: 40 }}>
          <div style={{ fontFamily: font.display, fontSize: 40, color: color.periwinkle, minWidth: 210 }}>Live demo</div>
          <div style={{ fontFamily: font.body, fontWeight: 600, fontSize: 50, color: '#fff', opacity: fadeIn, transform: `translateY(${(1 - fadeIn) * 10}px)` }}>{text}</div>
        </div>
      </AbsoluteFill>
    );
  }
  const pulse = 0.5 + 0.5 * Math.sin(frame / 20);
  return (
    <AbsoluteFill style={{ background: color.night, justifyContent: 'center', alignItems: 'center', gap: 30 }}>
      <div style={{ width: 120, height: 120, borderRadius: '50%', border: `4px solid ${color.periwinkle}`, opacity: 0.4 + 0.6 * pulse, transform: `scale(${0.9 + 0.1 * pulse})` }} />
      <div style={{ fontFamily: font.display, fontSize: 120, color: '#fff' }}>Live demo</div>
      <div style={{ fontFamily: font.body, fontWeight: 500, fontSize: 36, color: color.nightText }}>Recording goes here (60 s)</div>
    </AbsoluteFill>
  );
};
