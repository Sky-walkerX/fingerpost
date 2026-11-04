import { AbsoluteFill } from 'remotion';
import { useFontsReady } from './fonts.ts';
import { color, font } from './tokens.ts';

export const Promo: React.FC = () => {
  useFontsReady();
  return (
    <AbsoluteFill style={{ background: color.night, color: '#fff', fontFamily: font.display, fontSize: 170, justifyContent: 'center', paddingLeft: 120 }}>
      Fingerpost.
    </AbsoluteFill>
  );
};
