package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class FingerGuidanceTest {
    private val quad = listOf(Vec2(100.0, 50.0), Vec2(900.0, 50.0), Vec2(900.0, 450.0), Vec2(100.0, 450.0))
    private val polygon = listOf(Vec2(0.4, 0.4), Vec2(0.6, 0.4), Vec2(0.6, 0.6), Vec2(0.4, 0.6))
    private val hand = HandSample(Vec2(520.0, 250.0), Vec2(440.0, 250.0), 0.9)

    @Test fun padCompensationAndHomographyPlaceFingerOnTarget() {
        val guidance = FingerGuidance()
        guidance.setTarget(polygon, 2.0)
        val sample = guidance.update(100, 1000, 500, listOf(hand), quad)!!
        assertEquals(Zone.ON, sample.zone)
        assertEquals(0.5, sample.uv.x, 1e-9)
        assertEquals(0.0, sample.error.length, 1e-9)
    }

    @Test fun repeatedAndOlderLandmarkResultsCannotCountAsNewFrames() {
        val guidance = FingerGuidance()
        guidance.setTarget(polygon, 2.0)
        assertNotNull(guidance.update(100, 1000, 500, listOf(hand), quad))
        assertNull(guidance.update(100, 1000, 500, listOf(hand), quad))
        assertNull(guidance.update(99, 1000, 500, listOf(hand), quad))
        assertNotNull(guidance.update(101, 1000, 500, listOf(hand), quad))
    }

    @Test fun choosesTheValidHandNearestTheTarget() {
        val guidance = FingerGuidance()
        guidance.setTarget(polygon, 2.0)
        val far = HandSample(Vec2(150.0, 100.0), Vec2(150.0, 90.0), 0.9)
        val invalid = hand.copy(presence = 0.5)
        assertEquals(Zone.ON, guidance.update(100, 1000, 500, listOf(far, invalid, hand), quad)!!.zone)
    }

    @Test fun noHandOrMissingQuadProducesNoGuidance() {
        val guidance = FingerGuidance()
        guidance.setTarget(polygon, 2.0)
        assertNull(guidance.update(100, 1000, 500, emptyList(), quad))
        assertNull(guidance.update(101, 1000, 500, listOf(hand), null))
    }

    @Test fun offScreenPadProducesNoGuidance() {
        val guidance = FingerGuidance()
        guidance.setTarget(polygon, 2.0)
        val outside = HandSample(Vec2(0.0, 0.0), Vec2(-100.0, 0.0), 0.9)
        assertNull(guidance.update(100, 1000, 500, listOf(outside), quad))
    }

    @Test fun changingTargetResetsTheCoordinateFilters() {
        val guidance = FingerGuidance()
        guidance.setTarget(polygon, 2.0)
        guidance.update(100, 1000, 500, listOf(hand), quad)
        guidance.setTarget(polygon, 2.0)
        val moved = hand.copy(tip = Vec2(700.0, 350.0), dip = Vec2(700.0, 350.0))
        assertEquals(0.75, guidance.update(101, 1000, 500, listOf(moved), quad)!!.uv.x, 1e-9)
    }
}
