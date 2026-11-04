import { Fragment } from 'react';
import { Composition, Still } from 'remotion';
import { Banner, BANNER } from './banner.tsx';
import { FlowDiagram, FLOW } from './flow-diagram.tsx';
import { Pitch } from './pitch/pitch.tsx';
import { PITCH_TOTAL } from './pitch/timeline.ts';
import { Promo } from './promo.tsx';
import { TOTAL_FRAMES } from './timeline.ts';
import { FPS, HEIGHT, WIDTH } from './tokens.ts';

export const Root: React.FC = () => (
  <Fragment>
    <Composition id="Promo" component={Promo} fps={FPS} width={WIDTH} height={HEIGHT} durationInFrames={TOTAL_FRAMES} />
    <Still id="Banner" component={Banner} width={BANNER.width} height={BANNER.height} />
    <Still id="Flow" component={FlowDiagram} width={FLOW.width} height={FLOW.height} />
    <Composition id="Pitch" component={Pitch} fps={FPS} width={WIDTH} height={HEIGHT} durationInFrames={PITCH_TOTAL} />
  </Fragment>
);
