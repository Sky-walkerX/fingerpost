import { Fragment } from 'react';
import { Composition } from 'remotion';
import { Pitch } from './pitch/pitch.tsx';
import { PITCH_TOTAL } from './pitch/timeline.ts';
import { Promo } from './promo.tsx';
import { TOTAL_FRAMES } from './timeline.ts';
import { FPS, HEIGHT, WIDTH } from './tokens.ts';

export const Root: React.FC = () => (
  <Fragment>
    <Composition id="Promo" component={Promo} fps={FPS} width={WIDTH} height={HEIGHT} durationInFrames={TOTAL_FRAMES} />
    <Composition id="Pitch" component={Pitch} fps={FPS} width={WIDTH} height={HEIGHT} durationInFrames={PITCH_TOTAL} />
  </Fragment>
);
