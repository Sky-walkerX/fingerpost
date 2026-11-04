import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Bubble } from '../components/bubble.tsx';
import { KioskScreen } from '../components/kiosk-screen.tsx';
import { progress } from '../components/motion.ts';
import { appQuote, copy } from '../copy.ts';
import { beatsWithin } from '../timeline.ts';
import { color } from '../tokens.ts';

/** Scene 4: the user asks for the pay button; Fingerpost reads the amount and waits for "yes" first, as the app does. */
export const Confirm: React.FC = () => {
  const frame = useCurrentFrame();
  const beats = beatsWithin('confirm');
  const at = (min: number) => beats.find((b) => b >= min) ?? min;
  const ask = at(8), reply = at(ask + 80), yes = at(reply + 150);
  const glow = progress(frame, reply, 16) * (1 - progress(frame, yes + 20, 20));
  return (
    <AbsoluteFill style={{ background: color.day }}>
      <div style={{ position: 'absolute', left: 120, top: 150, width: 900, display: 'flex', flexDirection: 'column', gap: 34 }}>
        <Bubble who="you" text={copy.userSays.payByCard} at={ask} speaking={[ask, ask + 60]} />
        <Bubble who="fingerpost" text={`${copy.confirmSummary} ${appQuote.sayYesToPay}`} at={reply} />
        <Bubble who="you" text={copy.userSays.yes} at={yes} speaking={[yes, yes + 30]} />
      </div>
      <div style={{ position: 'absolute', left: 1180, top: 150, borderRadius: 34, overflow: 'hidden', boxShadow: '0 50px 90px -40px rgba(13,24,48,0.5), 0 2px 10px rgba(13,24,48,0.06)' }}>
        <KioskScreen width={560} totalGlow={glow} />
      </div>
      <Sequence from={reply} durationInFrames={30}><Audio src={staticFile('sfx/tone-1.wav')} volume={0.25} /></Sequence>
    </AbsoluteFill>
  );
};
