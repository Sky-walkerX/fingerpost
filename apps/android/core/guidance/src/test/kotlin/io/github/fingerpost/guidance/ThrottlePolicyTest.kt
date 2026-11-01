package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class ThrottlePolicyTest {
    @Test
    fun strideReturns1WhenStatusLowAndInferenceFast() {
        assertEquals(1, ThrottlePolicy.stride(0, 20L))
        assertEquals(1, ThrottlePolicy.stride(1, 39L))
        assertEquals(1, ThrottlePolicy.stride(0, 0L))
    }

    @Test
    fun strideReturns2WhenThermalStatusModerate() {
        assertEquals(2, ThrottlePolicy.stride(2, 20L))
        assertEquals(2, ThrottlePolicy.stride(3, 20L))
    }

    @Test
    fun strideReturns2WhenInferenceSlow() {
        assertEquals(2, ThrottlePolicy.stride(0, 40L))
        assertEquals(2, ThrottlePolicy.stride(0, 45L))
        assertEquals(2, ThrottlePolicy.stride(1, 55L))
    }

    @Test
    fun strideReturns3WhenThermalStatusSevere() {
        assertEquals(3, ThrottlePolicy.stride(4, 20L))
        assertEquals(3, ThrottlePolicy.stride(5, 50L))
        assertEquals(3, ThrottlePolicy.stride(6, 10L))
    }

    @Test
    fun interpolateVec2() {
        val a = Vec2(10.0, 20.0)
        val b = Vec2(30.0, 60.0)
        assertEquals(Vec2(20.0, 40.0), ThrottlePolicy.interpolate(a, b, 0.5))
        assertEquals(Vec2(10.0, 20.0), ThrottlePolicy.interpolate(a, b, 0.0))
        assertEquals(Vec2(30.0, 60.0), ThrottlePolicy.interpolate(a, b, 1.0))
        assertEquals(Vec2(40.0, 80.0), ThrottlePolicy.interpolate(a, b, 1.5))
    }

    @Test
    fun interpolateHandSample() {
        val a = HandSample(Vec2(10.0, 20.0), Vec2(12.0, 25.0), 0.8)
        val b = HandSample(Vec2(20.0, 40.0), Vec2(22.0, 45.0), 1.0)
        val mid = ThrottlePolicy.interpolate(a, b, 0.5)
        assertEquals(Vec2(15.0, 30.0), mid.tip)
        assertEquals(Vec2(17.0, 35.0), mid.dip)
        assertEquals(0.9, mid.presence, 0.001)
    }

    @Test
    fun interpolateHandSampleWithTimestamps() {
        val a = HandSample(Vec2(100.0, 100.0), Vec2(100.0, 120.0), 0.9)
        val b = HandSample(Vec2(200.0, 200.0), Vec2(200.0, 220.0), 0.9)
        val interp = ThrottlePolicy.interpolate(a, b, 1000L, 1100L, 1050L)
        assertEquals(Vec2(150.0, 150.0), interp.tip)
        assertEquals(Vec2(150.0, 170.0), interp.dip)
        assertEquals(0.9, interp.presence, 0.001)

        val extrapolated = ThrottlePolicy.interpolate(a, b, 1000L, 1100L, 1150L)
        assertEquals(Vec2(250.0, 250.0), extrapolated.tip)
        assertEquals(Vec2(250.0, 270.0), extrapolated.dip)
    }

    @Test
    fun interpolateBbox() {
        val a = Bbox(0.0, 10.0, 100.0, 110.0)
        val b = Bbox(20.0, 30.0, 120.0, 130.0)
        val mid = ThrottlePolicy.interpolate(a, b, 0.5)
        assertEquals(10.0, mid.minX, 0.001)
        assertEquals(20.0, mid.minY, 0.001)
        assertEquals(110.0, mid.maxX, 0.001)
        assertEquals(120.0, mid.maxY, 0.001)
    }

    @Test
    fun handInterpolatorUpdatesAndInterpolates() {
        val interpolator = HandInterpolator()
        assertNull(interpolator.interpolate(1000L))

        val s1 = HandSample(Vec2(10.0, 20.0), Vec2(10.0, 30.0), 0.9)
        interpolator.update(1000L, s1)
        val single = interpolator.interpolate(1016L)
        assertEquals(s1, single)

        val s2 = HandSample(Vec2(20.0, 40.0), Vec2(20.0, 50.0), 0.9)
        interpolator.update(1033L, s2)
        val interpolated = interpolator.interpolate(1066L)
        assertEquals(30.0, interpolated!!.tip.x, 0.01)
        assertEquals(60.0, interpolated.tip.y, 0.01)

        // Freshness: over 200 ms without update returns null
        assertNull(interpolator.interpolate(1300L))
    }
}
