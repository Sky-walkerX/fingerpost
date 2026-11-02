package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class GuidancePreferencesTest {
    @Test fun handednessBreaksDistanceTiesButNeverSelectsAnInvalidOrFartherHand() {
        val left = HandSample(Vec2(40.0, 50.0), Vec2(40.0, 60.0), 0.9, Handedness.LEFT)
        val right = left.copy(tip = Vec2(60.0, 50.0), hand = Handedness.RIGHT)
        assertEquals(left, chooseHand(listOf(right, left), 100, 100, Vec2(50.0, 50.0), Handedness.LEFT))
        assertEquals(right, chooseHand(listOf(left, right), 100, 100, Vec2(50.0, 50.0), Handedness.RIGHT))
        assertEquals(right, chooseHand(listOf(left, right), 100, 100, Vec2(59.0, 50.0), Handedness.LEFT))
        assertEquals(right, chooseHand(listOf(left.copy(presence = 0.1), right), 100, 100, null, Handedness.LEFT))
    }
    @Test fun conciseAndDetailedChangeOnlyGuidanceWordingAndPreserveSafetyCue() {
        val cue = GuideCue(listOf(Dir.UP, Dir.LEFT), MagnitudeWord.A_LITTLE, true)
        assertEquals("Slow down. Up a little.", Phrases.render(cue, "en", CueVerbosity.CONCISE))
        assertEquals("Slow down. Up and left a little.", Phrases.render(cue))
        assertEquals("Slow down. Move your finger up and left a little.", Phrases.render(cue, "en", CueVerbosity.DETAILED))
        for (locale in listOf("en", "hi", "es")) {
            assertFalse(Phrases.render(cue, locale, CueVerbosity.DETAILED).isNullOrBlank())
        }
    }
    @Test fun chestMountCoachMovesTheBodyWithoutChangingScreenAxes() {
        assertEquals("Turn your body left.", Strings.framing(FramingCue.MOVE_LEFT, Strings.EN, chestMount = true))
        assertEquals("Move the phone left.", Strings.framing(FramingCue.MOVE_LEFT))
        assertEquals("Tilt your body up.", Strings.framing(FramingCue.MOVE_UP, Strings.EN, true))
        assertEquals("Step back a little.", Strings.framing(FramingCue.MOVE_BACK, Strings.EN, true))
        for (locale in listOf(Strings.EN, Strings.HI, Strings.ES)) {
            assertNotEquals(Strings.framing(FramingCue.CUT_LEFT, locale), Strings.framing(FramingCue.CUT_LEFT, locale, true))
        }
    }
}
