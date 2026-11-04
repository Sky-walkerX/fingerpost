import { Composition } from 'remotion';
import { Promo } from './promo.tsx';
import { FPS, HEIGHT, WIDTH } from './tokens.ts';

const TOTAL_FRAMES = 45 * FPS;

export const Root: React.FC = () => (
  <Composition id="Promo" component={Promo} fps={FPS} width={WIDTH} height={HEIGHT} durationInFrames={TOTAL_FRAMES} />
);
