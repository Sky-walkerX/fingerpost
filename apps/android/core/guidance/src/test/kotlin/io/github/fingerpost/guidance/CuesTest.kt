package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class CuesTest {
    @Test fun toneAtFarIs220() = assertEquals(220.0, toneFrequencyHz(0.5), 1e-9)
    @Test fun toneAtZeroIs1760() = assertEquals(1760.0, toneFrequencyHz(0.0), 1e-9)
    @Test fun toneMidwayIs622() = assertEquals(220.0 * Math.pow(2.0, 1.5), toneFrequencyHz(0.25), 1e-9)
    @Test fun toneClampsBeyondFar() = assertEquals(220.0, toneFrequencyHz(2.0), 1e-9)
    @Test fun toneTreatsNegativeAsZero() = assertEquals(1760.0, toneFrequencyHz(-0.1), 1e-9)
    @Test fun panClamps() {
        assertEquals(1.0, tonePan(0.9), 1e-9)
        assertEquals(-0.5, tonePan(-0.15), 1e-9)
        assertEquals(-1.0, tonePan(-5.0), 1e-9)
    }
    @Test fun magnitudeBuckets() {
        assertEquals(MagnitudeWord.A_LOT, magnitudeWord(0.31))
        assertEquals(MagnitudeWord.NONE, magnitudeWord(0.30))
        assertEquals(MagnitudeWord.NONE, magnitudeWord(0.10))
        assertEquals(MagnitudeWord.A_LITTLE, magnitudeWord(0.0999))
        assertEquals(MagnitudeWord.A_LITTLE, magnitudeWord(0.03))
        assertNull(magnitudeWord(0.0299))
    }
}
