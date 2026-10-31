package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class ScreenMeteringTest {
    private val quad = listOf(Vec2(.2,.3), Vec2(.6,.3), Vec2(.6,.9), Vec2(.2,.9))

    @Test fun `stable screen meters its centre`() {
        val point = requireNotNull(ScreenMetering().update(quad, true, 0))
        assertEquals(.4, point.x, 1e-9); assertEquals(.6, point.y, 1e-9)
    }
    @Test fun `unstable or absent geometry never meters`() {
        val meter = ScreenMetering()
        assertNull(meter.update(quad, false, 0))
        assertNull(meter.update(null, true, 1))
    }
    @Test fun `refresh matches five second focus cancellation instead of every frame`() {
        val meter = ScreenMetering()
        assertNotNull(meter.update(quad, true, 0))
        assertNull(meter.update(quad, true, 4_999))
        assertNotNull(meter.update(quad, true, 5_000))
    }
    @Test fun `reacquired stable geometry meters immediately`() {
        val meter = ScreenMetering()
        meter.update(quad, true, 0)
        meter.update(quad, false, 100)
        assertNotNull(meter.update(quad, true, 200))
    }
    @Test fun `invalid points cannot reach the camera control`() {
        for (invalid in listOf(emptyList(), quad.take(3), quad.map { Vec2(Double.NaN,it.y) },
            quad.map { Vec2(it.x,Double.POSITIVE_INFINITY) }, quad.map { Vec2(it.x+2,it.y) }))
            assertNull(ScreenMetering().update(invalid, true, 0))
    }
}
