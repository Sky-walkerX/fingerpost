import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrandMark } from '../components/brand-mark.tsx';
import { progress, rise } from '../components/motion.ts';
import { ToneLine } from '../components/tone-line.tsx';
import { Waveform } from '../components/waveform.tsx';
import { Wipe } from '../components/wipe.tsx';
import { copy } from '../copy.ts';
import { beatsWithin } from '../timeline.ts';
import { color, font, springs } from '../tokens.ts';

const Buzz: React.FC = () => {
  const frame = useCurrentFrame();
  const x = frame % 40 < 12 ? Math.sin(frame * 2.2) * 5 : 0;
  return (
    <svg width="110" height="80" viewBox="0 0 72 48" style={{ transform: `translateX(${x}px)` }} aria-hidden="true">
      <rect x="24" y="5" width="24" height="38" rx="6" fill="none" stroke={color.blue} strokeWidth="4" />
      <path d="M12 14v20M4 19v10M60 14v20M68 19v10" stroke={color.peach} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
};

/** Scene 7: the three feedback channels, the languages, and the end card. */
export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beats = beatsWithin('close');
  const at = (min: number) => beats.find((b) => b >= min) ?? min;
  const ch = at(22), langs = at(ch + 70), end = at(langs + 100);
  const out = progress(frame, end - 12, 12);
  const card = spring({ frame: frame - end, fps, config: springs.calm });
  const glyphs = [<Waveform key="v" active bars={10} tone={color.blue} />, <ToneLine key="t" level={0.8} width={200} height={70} />, <Buzz key="b" />];
  return (
    <AbsoluteFill style={{ background: color.night }}>
      <Wipe to="day">
        <AbsoluteFill style={{ opacity: 1 - out }}>
          <div style={{ position: 'absolute', left: 130, top: 200, display: 'flex', gap: 110 }}>
            {copy.close.channels.map((name, i) => (
              <div key={name} style={{ ...rise(frame, ch + i * 10), display: 'flex', flexDirection: 'column', gap: 26 }}>
                <div style={{ height: 90, display: 'flex', alignItems: 'center' }}>{glyphs[i]}</div>
                <div style={{ fontFamily: font.display, fontSize: 110, color: color.ink, lineHeight: 1 }}>{name}</div>
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', left: 130, top: 600, display: 'flex', gap: 56, fontFamily: font.display, fontSize: 96, color: color.blue, ...rise(frame, langs) }}>
            {copy.close.languages.map((l) => <span key={l.lang} lang={l.lang}>{l.text}</span>)}
          </div>
          <div style={{ position: 'absolute', left: 130, top: 790, fontFamily: font.body, fontWeight: 600, fontSize: 48, color: color.muted, ...rise(frame, langs + 30) }}>{copy.close.tag}</div>
        </AbsoluteFill>
        {frame >= end - 12 ? (
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: card }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 44, transform: `scale(${0.92 + 0.08 * card})` }}>
              <BrandMark size={180} />
              <div style={{ fontFamily: font.display, fontSize: 230, color: color.ink, lineHeight: 1 }}>{copy.answer.name}</div>
            </div>
            <div style={{ marginTop: 40, fontFamily: font.body, fontWeight: 600, fontSize: 52, color: color.blue, ...rise(frame, end + 18) }}>{copy.close.url}</div>
            <div style={{ marginTop: 14, fontFamily: font.body, fontWeight: 500, fontSize: 36, color: color.muted, ...rise(frame, end + 28) }}>{copy.close.tag}</div>
          </AbsoluteFill>
        ) : null}
      </Wipe>
    </AbsoluteFill>
  );
};
