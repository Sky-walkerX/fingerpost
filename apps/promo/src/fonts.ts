import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource-variable/hanken-grotesk/wght.css';
import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

/** Holds every frame until the brand fonts are loaded, so no frame renders in a fallback face. */
export function useFontsReady(): void {
  const [handle] = useState(() => delayRender('Loading brand fonts'));
  useEffect(() => {
    const faces = ['400 40px "Instrument Serif"', 'italic 400 40px "Instrument Serif"', '600 40px "Hanken Grotesk Variable"'];
    Promise.all(faces.map((f) => document.fonts.load(f))).then(() => document.fonts.ready).then(() => continueRender(handle));
  }, [handle]);
}
