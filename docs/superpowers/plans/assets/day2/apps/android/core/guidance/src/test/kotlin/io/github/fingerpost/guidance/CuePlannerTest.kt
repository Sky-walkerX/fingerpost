package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class CuePlannerTest {
    @Test fun dominantAxisOnlyWhenTheOtherIsSmall() =
        assertEquals(GuideCue(listOf(Dir.RIGHT), MagnitudeWord.NONE), CuePlanner().plan(Vec2(0.2, 0.05), Orientation.UPRIGHT, 0))

    @Test fun bothAxesWhenSecondaryIsAtLeast40Percent() =
        assertEquals(GuideCue(listOf(Dir.UP, Dir.LEFT), MagnitudeWord.A_LOT), CuePlanner().plan(Vec2(-0.2, -0.3), Orientation.UPRIGHT, 0))

    @Test fun flatScreensUseForwardAndBack() {
        assertEquals(listOf(Dir.FORWARD), CuePlanner().plan(Vec2(0.0, -0.2), Orientation.FLAT, 0)!!.dirs)
        assertEquals(listOf(Dir.BACK), CuePlanner().plan(Vec2(0.0, 0.2), Orientation.FLAT, 0)!!.dirs)
    }

    @Test fun belowThreeHundredthsNothingIsSpoken() = assertNull(CuePlanner().plan(Vec2(0.02, 0.01), Orientation.UPRIGHT, 0))

    @Test fun twoOvershootsWithinTwoSecondsSaySlowDownOnceThenALittleFor3s() {
        val p = CuePlanner()
        p.plan(Vec2(0.2, 0.0), Orientation.UPRIGHT, 0)
        p.plan(Vec2(-0.2, 0.0), Orientation.UPRIGHT, 500)            // flip 1
        val c = p.plan(Vec2(0.2, 0.0), Orientation.UPRIGHT, 1000)!!  // flip 2 → slow down
        assertTrue(c.slowDown); assertEquals(MagnitudeWord.A_LITTLE, c.magnitude)
        val d = p.plan(Vec2(0.25, 0.0), Orientation.UPRIGHT, 2500)!!
        assertEquals(false, d.slowDown); assertEquals(MagnitudeWord.A_LITTLE, d.magnitude)
        assertEquals(MagnitudeWord.NONE, p.plan(Vec2(0.25, 0.0), Orientation.UPRIGHT, 4100)!!.magnitude)
    }

    @Test fun flipsMoreThanTwoSecondsApartDoNotTrigger() {
        val p = CuePlanner()
        p.plan(Vec2(0.2, 0.0), Orientation.UPRIGHT, 0)
        p.plan(Vec2(-0.2, 0.0), Orientation.UPRIGHT, 100)
        assertEquals(false, p.plan(Vec2(0.2, 0.0), Orientation.UPRIGHT, 2500)!!.slowDown)
    }

    @Test fun orientationThresholdIs55Degrees() {
        assertEquals(Orientation.UPRIGHT, orientationFor(55.0)); assertEquals(Orientation.FLAT, orientationFor(55.1))
    }

    @Test fun englishPhrases() {
        assertEquals("Up and left a lot.", Phrases.render(GuideCue(listOf(Dir.UP, Dir.LEFT), MagnitudeWord.A_LOT)))
        assertEquals("Right.", Phrases.render(GuideCue(listOf(Dir.RIGHT), MagnitudeWord.NONE)))
        assertEquals("Slow down. Forward a little.", Phrases.render(GuideCue(listOf(Dir.FORWARD), MagnitudeWord.A_LITTLE, slowDown = true)))
        assertEquals("Slow down.", Phrases.render(GuideCue(emptyList(), null, slowDown = true)))
        assertNull(Phrases.render(GuideCue(emptyList(), null)))
    }
}
