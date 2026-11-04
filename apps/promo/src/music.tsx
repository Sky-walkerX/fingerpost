import { Audio, staticFile } from 'remotion';
import { music, musicVolume } from './timeline.ts';
import { FPS } from './tokens.ts';

/** The licensed track (see public/music/LICENSE.md), trimmed to the chosen offset and faded at the end. */
export const Music: React.FC = () => (
  <Audio src={staticFile('music/upbeat-rock.mp3')} trimBefore={Math.round(music.offsetSec * FPS)} volume={musicVolume} />
);
