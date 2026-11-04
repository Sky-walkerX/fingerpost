import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { useFontsReady } from '../fonts.ts';
import { color, font } from '../tokens.ts';
import { sensorySceneComponents } from './scenes.tsx';
import { captions, SENSORY, sensoryMusicVolume, sensoryScenes } from './story.ts';
import narration from './narration.json' with { type: 'json' };
import durations from './voice-durations.json' with { type: 'json' };

const voiceDurations: Record<string, number> = durations;

/** Caption bands are independent of scene transitions, so spoken safety copy never disappears mid-sentence. */
const Captions: React.FC = () => {
  const f = useCurrentFrame();
  const c = captions.find((c) => f >= c.from && f < Math.min(c.end, c.from + Math.ceil((voiceDurations[c.id]! + 0.12) * 60)));
  if (!c) return null;
  const label = c.kind === 'app' ? 'FINGERPOST' : c.kind === 'user' ? 'YOU' : '';
  return <div style={{ position: 'absolute', left: 75, right: 75, bottom: 34, display: 'flex', justifyContent: 'center', zIndex: 100 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, maxWidth: 1740, padding: '18px 28px', borderRadius: 15, background: 'rgba(2,5,12,0.92)', color: '#fff', boxShadow: '0 5px 25px rgba(0,0,0,0.1)', fontFamily: font.body, fontSize: 39, fontWeight: 550, lineHeight: 1.3, textAlign: 'center' }}>
      {label ? <span style={{ flexShrink: 0, fontSize: 19, fontWeight: 750, letterSpacing: '0.1em', color: c.kind === 'user' ? color.periwinkle : color.peach }}>{label}</span> : null}
      <span>{c.text}</span>
    </div>
  </div>;
};

const AudioMix: React.FC = () => <>
  <Audio src={staticFile('music/upbeat-rock.mp3')} trimBefore={Math.round(5.927 * 60)} volume={(frame) => {
    const voiceActive = narration.segments.some((s) => frame >= s.at * 60 - 8 && frame < (s.at + voiceDurations[s.id]! + 0.12) * 60);
    return Math.min(sensoryMusicVolume(frame), voiceActive ? 0.16 : 1);
  }} />
  <Audio src={staticFile('sensory/sound-design.wav')} volume={0.78} />
  {narration.segments.map((s) => <Sequence key={s.id} from={Math.round(s.at * 60)} durationInFrames={Math.ceil(s.maxDuration * 60)} layout="none" name={`voice-${s.id}`}><Audio src={staticFile(`sensory/vo/${s.id}.wav`)} volume={1} /></Sequence>)}
</>;

export const SensoryPromo: React.FC = () => {
  useFontsReady();
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: color.night, overflow: 'hidden' }}>
    <AudioMix />
    {sensoryScenes.map((s) => {
      const Scene = sensorySceneComponents[s.id];
      return <Sequence key={s.id} from={s.from} durationInFrames={s.duration} name={s.id}><Scene /></Sequence>;
    })}
    <Captions />
    <div style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${f / (SENSORY.frames - 1) * 100}%`, background: color.peach, opacity: 0.65 }} />
  </AbsoluteFill>;
};
