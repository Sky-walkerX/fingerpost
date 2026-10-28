package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class GuidanceGeometryBoundaryTest {
    @Test fun anOnFrameBreaksTheConsecutiveLeavingRun() {
        val d = OnTargetDebouncer()
        repeat(6) { d.update(Zone.ON) }
        repeat(2) { assertFalse(d.update(Zone.FAR)) }
        assertFalse(d.update(Zone.ON))
        repeat(2) { assertFalse(d.update(Zone.NEAR)) }
        assertTrue(d.onTarget)
        assertTrue(d.update(Zone.EDGE))
        assertFalse(d.onTarget)
    }

    @Test fun resetDropsTheStateAndBothPartialRuns() {
        val d = OnTargetDebouncer()
        repeat(6) { d.update(Zone.ON) }
        repeat(2) { d.update(Zone.EDGE) }
        d.reset()
        assertFalse(d.onTarget)
        repeat(5) { assertFalse(d.update(Zone.ON)) }
        assertTrue(d.update(Zone.ON))
        repeat(2) { assertFalse(d.update(Zone.FAR)) }
        assertTrue(d.update(Zone.FAR))
    }

    @Test fun stableZonesEmitOnlyOneTransitionInEachDirection() {
        val d = OnTargetDebouncer()
        assertEquals(1, (1..100).count { d.update(Zone.ON) })
        assertEquals(1, (1..100).count { d.update(Zone.EDGE) })
    }

    @Test fun handValidityIncludesThePresenceAndImageBoundaries() {
        val hand = HandSample(Vec2(640.0, 480.0), Vec2(640.0, 470.0), 0.6)
        assertEquals(hand, chooseHand(listOf(hand), 640, 480, null))
        assertEquals(null, chooseHand(listOf(hand.copy(tip = Vec2(640.1, 480.0))), 640, 480, null))
    }

    @Test fun equalDistanceHandsRetainInputOrder() {
        val first = HandSample(Vec2(100.0, 100.0), Vec2(100.0, 110.0), 0.9)
        val second = first.copy(tip = Vec2(200.0, 100.0))
        assertEquals(first, chooseHand(listOf(first, second), 640, 480, Vec2(150.0, 100.0)))
    }

    @Test fun coincidentLandmarksHaveAWellDefinedPadPoint() {
        val point = Vec2(100.0, 100.0)
        assertEquals(point, padPoint(point, point))
    }
}
