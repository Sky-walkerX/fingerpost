package io.github.fingerpost.guidance

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class AnalysisFrameTransformTest {
    private fun transform(rotation: Int) = AnalysisFrameTransform(100, 50, 1280, 720, rotation)

    private fun assertPoint(x: Float, y: Float, actual: FramePoint) {
        assertEquals(x, actual.x, 0.001f)
        assertEquals(y, actual.y, 0.001f)
    }

    @Test fun `zero rotation crops raw offsets before landscape letterboxing`() {
        val transform = transform(0)
        assertEquals(1280, transform.uprightWidth)
        assertEquals(720, transform.uprightHeight)
        assertPoint(0f, 60f, transform.rawToModel(100f, 50f))
        assertPoint(640f, 60f, transform.rawToModel(1380f, 50f))
        assertPoint(0f, 420f, transform.rawToModel(100f, 770f))
        assertPoint(160f, 150f, transform.rawToModel(420f, 230f))
    }

    @Test fun `ninety degrees turns clockwise into a portrait letterbox`() {
        val transform = transform(90)
        assertEquals(720, transform.uprightWidth)
        assertEquals(1280, transform.uprightHeight)
        assertPoint(455f, 0f, transform.rawToModel(100f, 50f))
        assertPoint(455f, 480f, transform.rawToModel(1380f, 50f))
        assertPoint(185f, 0f, transform.rawToModel(100f, 770f))
        assertPoint(387.5f, 120f, transform.rawToModel(420f, 230f))
    }

    @Test fun `one hundred eighty degrees reverses both crop axes`() {
        val transform = transform(180)
        assertEquals(1280, transform.uprightWidth)
        assertEquals(720, transform.uprightHeight)
        assertPoint(640f, 420f, transform.rawToModel(100f, 50f))
        assertPoint(0f, 420f, transform.rawToModel(1380f, 50f))
        assertPoint(640f, 60f, transform.rawToModel(100f, 770f))
        assertPoint(480f, 330f, transform.rawToModel(420f, 230f))
    }

    @Test fun `two hundred seventy degrees turns counterclockwise into portrait`() {
        val transform = transform(270)
        assertEquals(720, transform.uprightWidth)
        assertEquals(1280, transform.uprightHeight)
        assertPoint(185f, 480f, transform.rawToModel(100f, 50f))
        assertPoint(185f, 0f, transform.rawToModel(1380f, 50f))
        assertPoint(455f, 480f, transform.rawToModel(100f, 770f))
        assertPoint(252.5f, 360f, transform.rawToModel(420f, 230f))
    }

    @Test fun `normalized landmarks remove portrait and landscape padding`() {
        assertPoint(240f, 800f, transform(90).normalizedToUpright(275f / 640, 300f / 480))
        assertPoint(320f, 180f, transform(0).normalizedToUpright(0.25f, 0.3125f))
        val customModel = AnalysisFrameTransform(20, 10, 400, 200, 0, 200, 200)
        assertPoint(0f, 50f, customModel.letterbox.map(0f, 0f))
        assertPoint(200f, 100f, customModel.normalizedToUpright(0.5f, 0.5f))
    }

    @Test fun `raw model roundtrip returns upright crop pixels for every rotation`() {
        val expected = listOf(
            FramePoint(320f, 180f), FramePoint(540f, 320f),
            FramePoint(960f, 540f), FramePoint(180f, 960f),
        )
        for ((index, rotation) in listOf(0, 90, 180, 270).withIndex()) {
            val transform = transform(rotation)
            val model = transform.rawToModel(420f, 230f)
            assertPoint(expected[index].x, expected[index].y,
                transform.normalizedToUpright(model.x / 640, model.y / 480))
        }
    }

    @Test fun `invalid crops model dimensions and rotations fail at construction`() {
        for ((left, top, width, height) in listOf(
            listOf(-1, 0, 1280, 720), listOf(0, -1, 1280, 720),
            listOf(0, 0, 0, 720), listOf(0, 0, 1280, -1),
        )) {
            assertFailsWith<IllegalArgumentException> {
                AnalysisFrameTransform(left, top, width, height, 0)
            }
        }
        for (rotation in listOf(-90, 1, 45, 360)) {
            assertFailsWith<IllegalArgumentException> { transform(rotation) }
        }
        assertFailsWith<IllegalArgumentException> { AnalysisFrameTransform(0, 0, 1280, 720, 0, 0, 480) }
        assertFailsWith<IllegalArgumentException> { AnalysisFrameTransform(0, 0, 1280, 720, 0, 640, -1) }
    }
}
