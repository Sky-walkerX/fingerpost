import unittest
import numpy as np
from sensory_sound import SR, guide_tone, sound_design


class SensorySoundTest(unittest.TestCase):
    def test_stereo_direction_moves_from_right_to_center(self):
        tone = guide_tone(np.arange(round(4.8 * SR)) / SR)
        early = tone[SR // 10:SR // 5]
        self.assertGreater(float(np.mean(early[:, 1] ** 2)), float(np.mean(early[:, 0] ** 2)) * 10)
        centered = tone[round(3.7 * SR):round(3.8 * SR)]
        self.assertTrue(np.allclose(centered[:, 0], centered[:, 1]))

    def test_stereo_soundtrack_is_finite_bounded_and_quiet_after_pin_lock(self):
        sounds = sound_design()
        self.assertEqual(sounds.shape, (56 * SR, 2))
        self.assertTrue(np.isfinite(sounds).all())
        self.assertLess(float(np.max(np.abs(sounds))), 1)
        self.assertEqual(float(np.max(np.abs(sounds[30 * SR:35 * SR]))), 0)

    def test_on_target_has_two_distinct_bass_attacks(self):
        sounds = sound_design()
        for at in (24.8, 24.92):
            start = round(at * SR)
            self.assertGreater(float(np.max(np.abs(sounds[start:start + SR // 30]))), 0.2)
        self.assertLess(float(np.max(np.abs(sounds[round(25.2 * SR):round(26 * SR)]))), 0.001)


if __name__ == '__main__':
    unittest.main()
