package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class FingertipTest {
    // Finger pointing up the image: tip at y=200, DIP at y=220. The pad sits a quarter of the way back towards the DIP.
    @Test fun padIsAQuarterOfTheTipSegmentBehindTheTip() = assertEquals(Vec2(100.0, 205.0), padPoint(Vec2(100.0, 200.0), Vec2(100.0, 220.0)))

    @Test fun lowPresenceHandsAreIgnored() = assertNull(chooseHand(listOf(HandSample(Vec2(10.0, 10.0), Vec2(10.0, 20.0), 0.59)), 640, 480, null))

    @Test fun tipOutsideTheFrameIsIgnored() = assertNull(chooseHand(listOf(HandSample(Vec2(-1.0, 10.0), Vec2(10.0, 20.0), 0.9)), 640, 480, null))

    @Test fun handNearestTheTargetWins() {
        val a = HandSample(Vec2(100.0, 100.0), Vec2(100.0, 120.0), 0.9)
        val b = HandSample(Vec2(500.0, 300.0), Vec2(500.0, 320.0), 0.8)
        assertEquals(b, chooseHand(listOf(a, b), 640, 480, Vec2(520.0, 310.0)))
        assertEquals(a, chooseHand(listOf(a, b), 640, 480, null))
    }

    @Test fun offScreenBounds() {
        assertFalse(isOffScreen(Vec2(-0.15, 1.15)))
        assertTrue(isOffScreen(Vec2(-0.16, 0.5)))
        assertTrue(isOffScreen(Vec2(0.5, 1.2)))
    }
}
