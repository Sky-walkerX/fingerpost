package io.github.fingerpost.guidance

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class FrameTransformTest {
    private fun assertPoint(x: Float, y: Float, actual: FramePoint) {
        assertEquals(x, actual.x, 0.001f)
        assertEquals(y, actual.y, 0.001f)
    }

    @Test fun `portrait model letterbox maps tip and dip back into upright pixels`() {
        val transform = FrameTransform.fitCenter(720, 1280, 640, 480)
        assertPoint(185f, 0f, transform.map(0f, 0f))
        assertPoint(455f, 480f, transform.map(720f, 1280f))
        assertPoint(360f, 640f, transform.unmap(320f, 240f))
        assertPoint(240f, 800f, transform.unmap(275f, 300f))
    }

    @Test fun `landscape model letterbox preserves aspect without stretching`() {
        val transform = FrameTransform.fitCenter(1280, 720, 640, 480)
        assertPoint(0f, 60f, transform.map(0f, 0f))
        assertPoint(640f, 420f, transform.map(1280f, 720f))
        assertPoint(640f, 360f, transform.unmap(320f, 240f))
    }

    @Test fun `fill center crops the same sides as a tall preview`() {
        val transform = FrameTransform.fillCenter(720, 1280, 1080, 2400)
        assertPoint(-135f, 0f, transform.map(0f, 0f))
        assertPoint(1215f, 2400f, transform.map(720f, 1280f))
        assertPoint(540f, 1200f, transform.map(360f, 640f))
    }

    @Test fun `fill center crops vertically in a wide preview`() {
        val transform = FrameTransform.fillCenter(1280, 720, 2400, 1080)
        assertPoint(0f, -135f, transform.map(0f, 0f))
        assertPoint(2400f, 1215f, transform.map(1280f, 720f))
        assertPoint(1200f, 540f, transform.map(640f, 360f))
    }

    @Test fun `matching aspect ratios need no padding or crop`() {
        for (transform in listOf(
            FrameTransform.fitCenter(640, 480, 1280, 960),
            FrameTransform.fillCenter(640, 480, 1280, 960),
        )) {
            assertPoint(0f, 0f, transform.map(0f, 0f))
            assertPoint(1280f, 960f, transform.map(640f, 480f))
        }
    }

    @Test fun `zero sized frames and views are rejected before projection`() {
        assertFailsWith<IllegalArgumentException> { FrameTransform.fitCenter(0, 720, 640, 480) }
        assertFailsWith<IllegalArgumentException> { FrameTransform.fillCenter(1280, 720, 0, 480) }
        assertFailsWith<IllegalArgumentException> { FrameTransform.fitCenter(1280, -1, 640, 480) }
        assertFailsWith<IllegalArgumentException> { FrameTransform.fillCenter(1280, 720, 640, 0) }
    }
}
