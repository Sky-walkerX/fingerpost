#!/usr/bin/env python3
"""Beat grid for the promo music: tempo, first beat and an even beat list, written as content-free JSON.

Usage:
  python3 scripts/promo_beats.py <audio> <out.json> [--offset SEC] [--seconds SEC]
  python3 scripts/promo_beats.py --provisional BPM <out.json> [--seconds SEC]
"""
import json
import subprocess
import sys

import numpy as np

HOP = 64
WINDOW = 256
LOW_BPM, HIGH_BPM = 90.0, 180.0


def onset_strength(samples: np.ndarray) -> np.ndarray:
    frames = 1 + max(0, len(samples) - WINDOW) // HOP
    idx = np.arange(WINDOW)[None, :] + HOP * np.arange(frames)[:, None]
    env = np.sqrt(np.mean(samples[idx].astype(np.float64) ** 2, axis=1))
    return np.maximum(0.0, np.diff(env, prepend=env[0]))


def estimate(samples: np.ndarray, sr: int) -> tuple[float, float]:
    """Returns (bpm folded into 90-180, time of the first beat in seconds)."""
    o = onset_strength(samples)
    o = o - o.mean()
    n = len(o)
    spectrum = np.fft.rfft(o, 2 * n)
    ac = np.fft.irfft(spectrum * np.conj(spectrum))[:n]
    frame_rate = sr / HOP
    lags = np.arange(int(frame_rate * 60 / 240), int(frame_rate * 60 / 60) + 1)
    bpms = 60 * frame_rate / lags
    # A log-normal preference around 120 BPM resolves octave ambiguity the way listeners do.
    weight = np.exp(-0.5 * (np.log2(bpms / 120.0)) ** 2)
    i = int(np.argmax(ac[lags] * weight))
    lag = float(lags[i])
    if 0 < i < len(lags) - 1:
        a, b, c = ac[lags[i - 1]], ac[lags[i]], ac[lags[i + 1]]
        denom = a - 2 * b + c
        if denom != 0:
            lag += 0.5 * (a - c) / denom
    bpm = 60 * frame_rate / lag
    while bpm < LOW_BPM:
        bpm *= 2
    while bpm > HIGH_BPM:
        bpm /= 2

    strength = onset_strength(samples)
    period = 60.0 / bpm * frame_rate
    phases = np.arange(int(round(period)))
    scores = [strength[np.round(np.arange(p, len(strength), period)).astype(int).clip(0, len(strength) - 1)].sum() for p in phases]
    phase = float(phases[int(np.argmax(scores))])
    onset = float(np.argmax(strength > 0.3 * strength.max()))
    k = np.ceil((onset - period / 2 - phase) / period)
    first_frame = phase + max(0.0, k) * period
    return bpm, (first_frame * HOP + WINDOW / 2) / sr


def beat_grid(bpm: float, first: float, seconds: float) -> list[float]:
    step = 60.0 / bpm
    count = int(np.floor((seconds - first) / step)) + 1
    return [first + i * step for i in range(max(0, count))]


def decode(path: str, offset: float, sr: int = 22050) -> np.ndarray:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(offset), '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def main(argv: list[str]) -> int:
    args = list(argv)
    def option(name: str, default: float) -> float:
        if name in args:
            i = args.index(name); value = float(args[i + 1]); del args[i:i + 2]; return value
        return default
    seconds = option('--seconds', 60.0)
    if '--provisional' in args:
        bpm = option('--provisional', 120.0)
        out = args[0]
        data = {'bpm': bpm, 'offsetSec': 0.0, 'beats': beat_grid(bpm, 0.0, seconds), 'provisional': True}
    else:
        offset = option('--offset', 0.0)
        audio, out = args[0], args[1]
        sr = 22050
        samples = decode(audio, offset, sr)
        bpm, first = estimate(samples, sr)
        data = {'bpm': round(bpm, 3), 'offsetSec': offset, 'beats': [round(b, 4) for b in beat_grid(bpm, first, min(seconds, len(samples) / sr))], 'provisional': False}
    with open(out, 'w') as f:
        json.dump(data, f, indent=1)
        f.write('\n')
    print(f"bpm {data['bpm']}, {len(data['beats'])} beats, offset {data['offsetSec']} s")
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
