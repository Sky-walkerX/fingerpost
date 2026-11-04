#!/usr/bin/env python3
"""Deterministic stereo sound design, caption sidecars and a mix plan for SensoryPromo.

Guidance pitch/pan/pulse and the 120 ms double click come from guidance-spec §7.
Other effects are editorial sounds, not product guidance parameters.
"""
import json
from pathlib import Path
import sys
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PROMO = ROOT / 'apps/promo'
SR = 48000
DURATION = 56


def guide_tone(seconds: np.ndarray) -> np.ndarray:
    x = 0.14 + 0.61 * np.clip(seconds / 2.2, 0, 1)
    y = 0.82 - 0.30 * np.clip((seconds - 2.2) / 2.6, 0, 1)
    error = np.hypot((0.75 - x) * 0.65, (0.52 - y) * 0.7)
    frequency = 220 * 2 ** (3 * (1 - np.minimum(error / 0.5, 1)))
    phase = np.cumsum(frequency) * (2 * np.pi / SR)
    pan = np.clip((0.75 - x) / 0.3, -1, 1)
    rate = 4 + 8 * (1 - np.minimum(error / 0.16, 1))
    pulse_phase = np.cumsum(rate) / SR % 1
    edge = np.minimum(pulse_phase, 0.5 - pulse_phase) / (rate * 0.005)
    pulse = np.where(error < 0.16, np.clip(edge, 0, 1), 1)
    envelope = np.clip(seconds / 0.005, 0, 1) * np.clip((4.8 - seconds) / 0.005, 0, 1)
    duck = np.where(((seconds >= 0.2) & (seconds < 1.4)) | ((seconds >= 2.3) & (seconds < 3.55)), 0.35, 1)
    mono = np.sin(phase) * pulse * envelope * duck * 0.18
    return np.stack([mono * np.cos((pan + 1) * np.pi / 4), mono * np.sin((pan + 1) * np.pi / 4)], axis=1)


def sound_design() -> np.ndarray:
    out = np.zeros((SR * DURATION, 2), dtype=np.float64)
    rng = np.random.default_rng(20261105)

    def add(at: float, samples: np.ndarray, gain: float = 1, pan: float = 0) -> None:
        start = round(at * SR)
        if samples.ndim == 1:
            samples = np.stack([samples * np.cos((pan + 1) * np.pi / 4), samples * np.sin((pan + 1) * np.pi / 4)], axis=1)
        length = min(len(samples), len(out) - start)
        out[start:start + length] += samples[:length] * gain

    def hit(length: float = 0.35, freq: float = 62) -> np.ndarray:
        t = np.arange(round(length * SR)) / SR
        phase = 2 * np.pi * (freq * t + 35 * (1 - np.exp(-t * 22)) / 22)
        return np.sin(phase) * np.exp(-t * 16) * np.minimum(1, t / 0.002)

    def air(length: float) -> np.ndarray:
        t = np.arange(round(length * SR)) / SR
        noise = rng.normal(0, 1, t.size)
        softened = np.convolve(noise, np.ones(9) / 9, mode='same')
        return softened * np.sin(np.pi * t / length) ** 2

    for at, pan in [(0.05, -0.7), (0.993, 0.6), (2.194, -0.4), (2.795, 0.5)]:
        add(at, air(0.25), 0.28, pan)
        add(at, hit(0.18, 96), 0.23)
    add(3.75, air(0.5), 0.34)
    add(4.0, hit(0.6, 48), 0.75)
    add(7.88, air(0.26), 0.20, 0.4)
    add(14.0, hit(0.2, 100), 0.18)
    add(19.15, hit(0.12, 160), 0.18)
    add(20, guide_tone(np.arange(round(4.8 * SR)) / SR))
    # A strong double click, not one long vibration: the app's on-target pattern.
    add(24.8, hit(0.18, 60), 0.7)
    add(24.92, hit(0.18, 60), 0.5)
    t = np.arange(round(0.08 * SR)) / SR
    add(24.8, np.sin(2 * np.pi * 1046.5 * t) * np.sin(np.pi * t / 0.08) * 0.12)
    add(27.3, hit(0.16, 132), 0.22)
    # A dry mechanical snap and low lock, followed by near silence.
    add(29.0, air(0.055), 0.9)
    add(29.005, hit(0.26, 42), 0.85)
    add(29.1, air(0.035), 0.45)
    for at, pan in [(35.65, -0.6), (36.42, 0), (37.18, 0.6)]:
        add(at, hit(0.15, 115), 0.17, pan)
    add(41.4, air(0.65), 0.3, -0.5)
    add(43.0, hit(0.5, 50), 0.4)
    add(50.5, hit(0.55, 55), 0.5)
    return out


def stamp(seconds: float, separator: str = '.') -> str:
    milliseconds = round(seconds * 1000)
    h, milliseconds = divmod(milliseconds, 3600000)
    m, milliseconds = divmod(milliseconds, 60000)
    s, milliseconds = divmod(milliseconds, 1000)
    return f'{h:02}:{m:02}:{s:02}{separator}{milliseconds:03}'


def main() -> None:
    out = PROMO / 'public/sensory'
    out.mkdir(parents=True, exist_ok=True)
    audio = sound_design()
    peak = float(np.max(np.abs(audio)))
    with wave.open(str(out / 'sound-design.wav'), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(audio, -0.96, 0.96) * 32767).astype('<i2').tobytes())
    spec = json.loads((PROMO / 'src/sensory/narration.json').read_text())
    durations = json.loads((PROMO / 'src/sensory/voice-durations.json').read_text())
    cues = []
    for s in spec['segments']:
        end = s['at'] + durations[s['id']]
        speaker = {'app': 'Fingerpost', 'user': 'User', 'narrator': 'Narrator'}[s['kind']]
        cues.append((s['at'], end, f"{speaker}: {s['text']}"))
    cues += [(20.0, 24.78, '[Guidance tone rises in pitch and moves toward the center]'), (24.8, 25.15, '[Double haptic thump]'), (29, 29.3, '[Mechanical lock. Music cuts to silence]')]
    cues.sort()
    deliver = PROMO / 'out/sensory'
    deliver.mkdir(parents=True, exist_ok=True)
    srt = '\n\n'.join(f'{i}\n{stamp(a, ",")} --> {stamp(b, ",")}\n{text}' for i, (a, b, text) in enumerate(cues, 1)) + '\n'
    vtt = 'WEBVTT\n\n' + '\n\n'.join(f'{stamp(a)} --> {stamp(b)}\n{text}' for a, b, text in cues) + '\n'
    (deliver / 'fingerpost-sensory.srt').write_text(srt)
    (deliver / 'fingerpost-sensory.vtt').write_text(vtt)
    (deliver / 'fingerpost-sensory-transcript.txt').write_text('\n\n'.join(text for _, _, text in cues) + '\n')
    print(f'56 s stereo SFX; peak {peak:.3f}; SRT/VTT/transcript written')


if __name__ == '__main__':
    main()
