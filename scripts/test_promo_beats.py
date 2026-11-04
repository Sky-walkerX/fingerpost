import unittest

import numpy as np

from promo_beats import beat_grid, estimate

SR = 22050


def clicks(bpm: float, seconds: float = 20.0, start: float = 0.5) -> np.ndarray:
    out = np.zeros(int(SR * seconds), dtype=np.float32)
    step = 60.0 / bpm
    t = start
    while t < seconds - 0.05:
        i = int(t * SR)
        burst = np.hanning(220) * np.sin(2 * np.pi * 1800 * np.arange(220) / SR)
        out[i:i + 220] += burst.astype(np.float32)
        t += step
    return out


class PromoBeatsTest(unittest.TestCase):
    def test_detects_tempo_of_click_track(self):
        bpm, _ = estimate(clicks(120), SR)
        self.assertAlmostEqual(bpm, 120, delta=1)

    def test_folds_half_and_double_tempo_into_range(self):
        for source in (60, 240):
            bpm, _ = estimate(clicks(source), SR)
            self.assertTrue(90 <= bpm <= 180, (source, bpm))
            self.assertAlmostEqual(bpm, 120, delta=1.5)

    def test_beats_are_evenly_spaced_from_first_onset(self):
        bpm, first = estimate(clicks(120, start=0.5), SR)
        self.assertAlmostEqual(first, 0.5, delta=0.02)
        beats = beat_grid(bpm, first, 10.0)
        steps = np.diff(beats)
        self.assertTrue(np.allclose(steps, 60.0 / bpm, atol=1e-9))
        self.assertAlmostEqual(beats[0], first)


if __name__ == '__main__':
    unittest.main()
