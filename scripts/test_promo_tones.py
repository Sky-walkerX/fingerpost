import os
import tempfile
import unittest
import wave

import numpy as np

from promo_tones import write_buzz, write_tone


def read(path):
    with wave.open(path) as w:
        frames = w.readframes(w.getnframes())
        return w.getframerate(), w.getnchannels(), w.getsampwidth(), np.frombuffer(frames, dtype=np.int16).astype(np.float64)


def dominant(samples, sr):
    spectrum = np.abs(np.fft.rfft(samples * np.hanning(len(samples))))
    return np.fft.rfftfreq(len(samples), 1 / sr)[int(np.argmax(spectrum))]


class PromoTonesTest(unittest.TestCase):
    def test_pitch_rises_with_level(self):
        with tempfile.TemporaryDirectory() as d:
            low, high = os.path.join(d, 'low.wav'), os.path.join(d, 'high.wav')
            write_tone(low, 0.12)
            write_tone(high, 1.0)
            sr, ch, width, a = read(low)
            _, _, _, b = read(high)
            self.assertEqual((sr, ch, width), (44100, 1, 2))
            self.assertAlmostEqual(dominant(a, sr), 330 + 0.12 * 560, delta=5)
            self.assertAlmostEqual(dominant(b, sr), 330 + 1.0 * 560, delta=5)

    def test_gap_shortens_as_the_finger_closes_in(self):
        with tempfile.TemporaryDirectory() as d:
            far, near = os.path.join(d, 'far.wav'), os.path.join(d, 'near.wav')
            write_tone(far, 0.12, count=3)
            write_tone(near, 1.0, count=3)
            self.assertGreater(read(far)[3].size, read(near)[3].size)

    def test_buzz_is_short_and_low(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, 'buzz.wav')
            write_buzz(path)
            sr, _, _, s = read(path)
            self.assertAlmostEqual(s.size / sr, 0.14, delta=0.01)
            self.assertLess(dominant(s, sr), 120)


if __name__ == '__main__':
    unittest.main()
