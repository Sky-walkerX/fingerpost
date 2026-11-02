package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

/**
 * guidance-spec §10.1 tolerances are in pixels: 0.9 × the median key height between columns. Tokens are normalized
 * per axis, so the column tolerance must be scaled by the space's aspect (width / height in pixels). Without it, a
 * wide screen's tolerance is too wide and neighbouring key columns merge, hiding a plain keypad.
 */
class PinGateAspectTest {
    /** A phone keypad, keys 0.117 × 0.15, columns [dx] apart and rows 0.18 apart (normalized units). */
    private fun pad(dx: Double, h: Double = 0.15, dy: Double = 0.18) =
        (0 until 9).map { i -> OcrToken("${i + 1}", 0.3 + (i % 3) * dx, 0.1 + (i / 3) * dy, 0.08, h) } + OcrToken("0", 0.3 + dx, 0.1 + 3 * dy, 0.08, h)

    @Test fun narrowKeypadOnAWideScreenIsBlocked() {
        // 1280 × 800: columns 128 px apart, keys 120 px tall. Before the fix this read as one column.
        assertEquals(PinGateReason.DIGIT_GRID, PinGate.check(pad(0.10), aspect = 1280.0 / 800))
        assertEquals(PinGateReason.DIGIT_GRID, PinGate.check(pad(0.12), aspect = 16.0 / 9))
    }

    @Test fun portraitFrameKeepsWorking() {
        // 720 × 1280 portrait camera frame: keys 77 px tall, columns 101 px apart.
        assertEquals(PinGateReason.DIGIT_GRID, PinGate.check(pad(0.14, h = 0.06, dy = 0.08), aspect = 720.0 / 1280))
    }

    @Test fun squareSpaceIsUnchanged() {
        assertEquals(PinGateReason.DIGIT_GRID, PinGate.check(pad(0.136)))
        assertEquals(PinGate.check(pad(0.136)), PinGate.check(pad(0.136), aspect = 1.0))
    }

    @Test fun aSingleColumnOfDigitsIsStillNotAKeypad() {
        val column = (0..9).map { OcrToken("$it", 0.5, 0.05 + it * 0.09, 0.03, 0.06) }
        assertEquals(PinGateReason.NONE, PinGate.check(column, aspect = 1.6))
    }

    @Test fun quadPixelAspectAveragesOppositeSides() {
        val full = listOf(Vec2(0.0, 0.0), Vec2(1.0, 0.0), Vec2(1.0, 1.0), Vec2(0.0, 1.0))
        assertEquals(1280.0 / 720, quadPixelAspect(full, 1280, 720), 1e-9)
        val tilted = listOf(Vec2(0.1, 0.2), Vec2(0.9, 0.1), Vec2(0.9, 0.9), Vec2(0.1, 0.8))
        assertEquals(Math.hypot(0.8, 0.1) / ((0.6 + 0.8) / 2), quadPixelAspect(tilted, 1000, 1000), 1e-9)
        assertEquals(1.0, quadPixelAspect(listOf(Vec2(0.0, 0.0), Vec2(0.0, 0.0), Vec2(0.0, 0.0), Vec2(0.0, 0.0)), 10, 10))
    }
}
