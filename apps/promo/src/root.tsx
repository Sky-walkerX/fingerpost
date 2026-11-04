import { Composition } from 'remotion';
import { Promo } from './promo.tsx';
import { TOTAL_FRAMES } from './timeline.ts';
import { FPS, HEIGHT, WIDTH } from './tokens.ts';

export const Root: React.FC = () => (
  <Composition id="Promo" component={Promo} fps={FPS} width={WIDTH} height={HEIGHT} durationInFrames={TOTAL_FRAMES} />
);
