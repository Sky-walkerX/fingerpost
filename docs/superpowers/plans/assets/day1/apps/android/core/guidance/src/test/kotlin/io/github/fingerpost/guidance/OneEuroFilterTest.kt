package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class OneEuroFilterTest {
    @Test fun firstSampleIsReturnedAsIs() = assertEquals(0.7, OneEuroFilter().filter(0.7, 0.0), 1e-12)

    @Test fun constantSignalIsUnchanged() {
        val f = OneEuroFilter()
        repeat(30) { assertEquals(0.4, f.filter(0.4, it / 30.0), 1e-9) }
    }

    @Test fun reducesJitterAt30Hz() {
        val f = OneEuroFilter()
        val input = (0 until 60).map { 0.4 + if (it % 2 == 0) 0.01 else -0.01 }
        val out = input.mapIndexed { i, x -> f.filter(x, i / 30.0) }.drop(15)
        fun variance(xs: List<Double>) = xs.average().let { m -> xs.sumOf { (it - m) * (it - m) } / xs.size }
        assertTrue(variance(out) < 0.25 * variance(input.drop(15)), "filtered variance should be < 25% of input")
    }

    @Test fun followsAFastMoveWithinAQuarterSecond() {
        val f = OneEuroFilter()
        repeat(10) { f.filter(0.2, it / 30.0) }
        var y = 0.0
        for (i in 10 until 18) y = f.filter(0.8, i / 30.0) // ~0.27 s after the step
        assertTrue(y > 0.6, "expected > 0.6 after the step, got $y")
    }

    @Test fun nonIncreasingTimestampReturnsPreviousValue() {
        val f = OneEuroFilter()
        f.filter(0.5, 1.0)
        assertEquals(0.5, f.filter(0.9, 1.0), 1e-12)
    }
}
