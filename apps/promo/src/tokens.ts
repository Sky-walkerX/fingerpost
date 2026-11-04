/** Style D tokens. The brand colours equal the website's (apps/web/index.html); tokens.test.ts keeps them equal. */
export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const color = {
  day: '#ffffff',
  panel: '#eff4fc',
  night: '#0d1830',
  raised: '#1b2c55',
  ink: '#0f1c35',
  muted: '#4b5873',
  nightText: '#c9d4ea',
  blue: '#2f5fd6',
  periwinkle: '#a9c1ff',
  peach: '#ffb98f',
} as const;

export const font = {
  display: '"Instrument Serif", Georgia, serif',
  body: '"Hanken Grotesk Variable", "Hanken Grotesk", system-ui, sans-serif',
} as const;

export const ease = { wipe: [0.76, 0, 0.24, 1] as const };
export const springs = { calm: { damping: 18 }, snappy: { damping: 12 } } as const;

/** Safe area for captions and statements at 1920 px wide. */
export const SAFE_WIDTH = 1680;
