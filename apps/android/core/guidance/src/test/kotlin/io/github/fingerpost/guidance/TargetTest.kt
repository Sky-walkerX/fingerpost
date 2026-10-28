package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class TargetTest {
    // A 0.2 × 0.1 (u × v) button on a 16:9 screen → 0.3556 × 0.1 in iso units.
    private val aspect = 16.0 / 9.0
    private val button = listOf(Vec2(0.4, 0.45), Vec2(0.6, 0.45), Vec2(0.6, 0.55), Vec2(0.4, 0.55))
    private val t = TargetGeometry(button, aspect)
    private fun iso(u: Double, v: Double) = t.toIso(Vec2(u, v))

    @Test fun zonesFromCentreOutwards() {
        assertEquals(Zone.ON, t.zone(iso(0.5, 0.5)))
        assertEquals(Zone.EDGE, t.zone(iso(0.405, 0.5)))     // inside, 0.009 from the edge < margin 0.015
        assertEquals(Zone.NEAR, t.zone(iso(0.5, 0.7)))       // outside, within 1.5 × max(bboxW, bboxH)
        assertEquals(Zone.FAR, t.zone(iso(0.05, 0.05)))
    }

    @Test fun marginIsFifteenPercentOfTheShortSide() = assertEquals(0.015, t.margin, 1e-12)

    @Test fun errorPointsFromPadToAnchorInIsoUnits() {
        val e = t.error(iso(0.4, 0.5))
        assertEquals(0.1 * aspect, e.x, 1e-9); assertEquals(0.0, e.y, 1e-9)
    }

    @Test fun thinTargetFallsBackToTheCentreDisc() {
        val thin = TargetGeometry(listOf(Vec2(0.1, 0.5), Vec2(0.9, 0.5), Vec2(0.9, 0.5005), Vec2(0.1, 0.5005)), 1.0)
        assertTrue(thin.useDisc)
        assertEquals(Zone.ON, thin.zone(Vec2(0.5, 0.50025)))
    }

    @Test fun normalTargetDoesNotUseTheDisc() = assertFalse(t.useDisc)

    @Test fun debouncerNeedsSixOnFramesToEnterAndThreeOffToLeave() {
        val d = OnTargetDebouncer()
        repeat(5) { assertFalse(d.update(Zone.ON)) }
        assertTrue(d.update(Zone.ON)); assertTrue(d.onTarget)
        assertFalse(d.update(Zone.EDGE)); assertFalse(d.update(Zone.EDGE))
        assertTrue(d.onTarget)
        assertTrue(d.update(Zone.EDGE)); assertFalse(d.onTarget)
    }

    @Test fun debouncerResetsTheRunOnAMiss() {
        val d = OnTargetDebouncer()
        repeat(5) { d.update(Zone.ON) }
        d.update(Zone.EDGE)
        repeat(5) { d.update(Zone.ON) }
        assertFalse(d.onTarget)
    }
}
