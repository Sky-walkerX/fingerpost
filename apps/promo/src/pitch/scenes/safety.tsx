import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { Bubble } from '../../components/bubble.tsx';
import { KioskScreen } from '../../components/kiosk-screen.tsx';
import { progress, rise } from '../../components/motion.ts';
import { Privacy } from '../../scenes/privacy.tsx';
import { appQuote, copy } from '../../copy.ts';
import { color, font } from '../../tokens.ts';
import { cue } from '../cue.ts';

const warning = appQuote.overcharge.replace('{shown}', '14.40').replace('{expected}', '12.40');

/** The amount is read and confirmed, a wrong total is flagged, and a PIN pad switches Fingerpost offline. */
export const Safety: React.FC = () => {
  const frame = useCurrentFrame();
  const c = cue('safety');
  const confirmAt = c.at('Before any pay button'), warnAt = c.at('and it warns you'), pinAt = c.at('On a PIN pad');
  return (
    <AbsoluteFill style={{ background: color.day }}>
      <div style={{ position: 'absolute', left: 130, top: 110, fontFamily: font.display, fontSize: 104, color: color.ink, ...rise(frame, c.voAt) }}>Safety is built in.</div>
      <div style={{ position: 'absolute', left: 130, top: 290, width: 900, display: 'flex', flexDirection: 'column', gap: 30 }}>
        <Bubble who="fingerpost" text={`${copy.confirmSummary} ${appQuote.sayYesToPay}`} at={confirmAt} />
        <div style={{ opacity: progress(frame, warnAt, 14) }}>
          <Bubble who="fingerpost" text={warning} at={warnAt} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 1180, top: 150, borderRadius: 34, overflow: 'hidden', boxShadow: '0 50px 90px -40px rgba(13,24,48,0.5)' }}>
        <KioskScreen width={560} totalGlow={progress(frame, confirmAt, 16)} total={frame >= warnAt - 12 ? '14.40' : '12.40'} />
      </div>
      <Sequence from={pinAt} durationInFrames={c.duration - pinAt}><Privacy beats={[]} /></Sequence>
    </AbsoluteFill>
  );
};
