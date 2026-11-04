import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption } from '../components/caption.tsx';
import { Kiosk3D } from '../components/kiosk3d.tsx';
import { outExpo } from '../components/motion.ts';
import { Phone3D } from '../components/phone3d.tsx';
import { copy } from '../copy.ts';
import { beatsWithin, sceneOf } from '../timeline.ts';
import { color, springs } from '../tokens.ts';

/** Scene 3: the phone floats above the kiosk, scans its display and locks on. Depth comes from light and shadow, not outlines. */
export const Scan: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { duration } = sceneOf('scan');
  const lockAt = beatsWithin('scan').find((b) => b >= duration * 0.5) ?? Math.round(duration * 0.55);
  const cam = (a: number, b: number) => interpolate(frame, [0, duration], [a, b], { easing: outExpo, extrapolateRight: 'clamp' });
  const enter = spring({ frame: frame - 8, fps, config: springs.calm });
  const lock = spring({ frame: frame - lockAt, fps, config: springs.snappy });
  const bob = Math.sin(frame / 26) * 10;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${color.day} 0%, ${color.day} 58%, ${color.panel} 100%)`, perspective: 2600, perspectiveOrigin: '50% 45%' }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transformStyle: 'preserve-3d', transform: `translate(${cam(420, 340)}px, ${cam(30, -20)}px) rotateX(${cam(10, 6)}deg) rotateY(${cam(-30, -18)}deg) scale(${cam(0.45, 0.52)})` }}>
        <Kiosk3D />
        <div style={{ position: 'absolute', transformStyle: 'preserve-3d', transform: `translate3d(${-600 + (1 - enter) * -300}px, ${-300 + bob + (1 - enter) * 700}px, ${600}px) rotateY(${22 - lock * 4}deg) rotateX(${18}deg)` }}>
          <Phone3D lock={lock} />
        </div>
      </div>
      <Caption text={copy.scan} tone="day" appear={lockAt + 4} speaker="fingerpost" />
    </AbsoluteFill>
  );
};
