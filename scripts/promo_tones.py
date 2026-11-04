#!/usr/bin/env python3
"""Guidance tones for the promo: the landing page's rising beep train, and the on-target buzz.

Usage: python3 scripts/promo_tones.py <out_dir>
Pitch is 330 + level * 560 Hz and the gap between beeps is 0.42 - level * 0.26 s, matching apps/web/src/site/landing.ts.
"""
import os
import sys
import wave

import numpy as np

SR = 44100
LEVELS = (0.12, 0.4, 0.72, 1.0)
BEEP = 0.16


def _save(path: str, samples: np.ndarray) -> None:
    pcm = (np.clip(samples, -1, 1) * 32767 * 0.8).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


def write_tone(path: str, level: float, count: int = 4) -> None:
    freq, gap = 330 + level * 560, 0.42 - level * 0.26
    t = np.arange(int(SR * BEEP)) / SR
    envelope = np.minimum(1, t / 0.01) * np.exp(-t / 0.05)
    beep = np.sin(2 * np.pi * freq * t) * envelope
    out = np.zeros(int(SR * (gap * (count - 1) + BEEP)))
    for i in range(count):
        start = int(SR * gap * i)
        out[start:start + beep.size] += beep
    _save(path, out)


def write_buzz(path: str) -> None:
    t = np.arange(int(SR * 0.14)) / SR
    wave_ = np.sign(np.sin(2 * np.pi * 60 * t)) * 0.5 + np.sin(2 * np.pi * 60 * t) * 0.5
    _save(path, wave_ * np.minimum(1, t / 0.005) * np.minimum(1, (0.14 - t) / 0.02))


def main(out_dir: str) -> None:
    os.makedirs(out_dir, exist_ok=True)
    for i, level in enumerate(LEVELS, start=1):
        write_tone(os.path.join(out_dir, f'tone-{i}.wav'), level)
    write_buzz(os.path.join(out_dir, 'buzz.wav'))
    print(f'wrote {len(LEVELS)} tones and a buzz to {out_dir}')


if __name__ == '__main__':
    main(sys.argv[1])
