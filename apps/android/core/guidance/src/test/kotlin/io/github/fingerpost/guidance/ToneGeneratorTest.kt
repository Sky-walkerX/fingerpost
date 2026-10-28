package io.github.fingerpost.guidance

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class ToneGeneratorTest {
    private fun block() = FloatArray(ToneGenerator.BLOCK_FRAMES * 2)

    @Test fun disabledIsSilent() {
        val samples = block()
        ToneGenerator().render(samples, 220.0, 0.0, false)
        assertTrue(samples.all { it == 0f })
    }

    @Test fun stableToneHasTheSpecifiedPitchAmplitudeAndCenteredPan() {
        val generator = ToneGenerator()
        val samples = block()
        generator.render(samples, 220.0, 0.0, true)
        generator.render(samples, 220.0, 0.0, true)
        for (frame in 0 until ToneGenerator.BLOCK_FRAMES) {
            val expected = 0.25 / sqrt(2.0) * sin(2 * PI * 220 * (240 + frame) / 48_000)
            assertEquals(expected, samples[2 * frame].toDouble(), 1e-6)
            assertEquals(expected, samples[2 * frame + 1].toDouble(), 1e-6)
        }
    }

    @Test fun startingAndStoppingRampAmplitudeOverFiveMilliseconds() {
        val generator = ToneGenerator()
        val samples = block()
        generator.render(samples, 220.0, 0.0, true)
        for (frame in 0 until 240) {
            val expected = 0.25 * (frame + 1) / 240 / sqrt(2.0) * sin(2 * PI * 220 * frame / 48_000)
            assertEquals(expected, samples[2 * frame].toDouble(), 1e-6)
        }
        generator.render(samples, 220.0, 0.0, false)
        for (frame in 0 until 240) {
            val expected = 0.25 * (1 - (frame + 1) / 240.0) / sqrt(2.0) *
                sin(2 * PI * 220 * (240 + frame) / 48_000)
            assertEquals(expected, samples[2 * frame].toDouble(), 1e-6)
        }
        generator.render(samples, 220.0, 0.0, false)
        assertTrue(samples.all { it == 0f })
    }

    @Test fun frequencyChangesRampWithoutResettingPhase() {
        val generator = ToneGenerator()
        val samples = block()
        generator.render(samples, 220.0, 0.0, true)
        generator.render(samples, 1760.0, 0.0, true)
        var phase = 2 * PI * 220 * 240 / 48_000
        for (frame in 0 until 240) {
            val expected = 0.25 / sqrt(2.0) * sin(phase)
            assertEquals(expected, samples[2 * frame].toDouble(), 1e-6)
            phase += 2 * PI * (220 + (1760 - 220) * (frame + 1) / 240.0) / 48_000
        }
        generator.render(samples, 1760.0, 0.0, true)
        for (frame in 0 until 240) {
            assertEquals(0.25 / sqrt(2.0) * sin(phase), samples[2 * frame].toDouble(), 1e-6)
            phase += 2 * PI * 1760 / 48_000
        }
    }

    @Test fun panningRampsWithEqualPower() {
        val generator = ToneGenerator()
        val samples = block()
        generator.render(samples, 220.0, -1.0, true)
        generator.render(samples, 220.0, 1.0, true)
        for (frame in 0 until 240) {
            val pan = -1 + 2 * (frame + 1) / 240.0
            val mono = 0.25 * sin(2 * PI * 220 * (240 + frame) / 48_000)
            assertEquals(mono * cos((pan + 1) * PI / 4), samples[2 * frame].toDouble(), 1e-6)
            assertEquals(mono * sin((pan + 1) * PI / 4), samples[2 * frame + 1].toDouble(), 1e-6)
            val energy = samples[2 * frame] * samples[2 * frame] + samples[2 * frame + 1] * samples[2 * frame + 1]
            assertEquals(mono * mono, energy.toDouble(), 1e-7)
        }
    }

    @Test fun extremePansSilenceTheOppositeChannel() {
        for (pan in listOf(-1.0, 1.0)) {
            val generator = ToneGenerator()
            val samples = block()
            repeat(2) { generator.render(samples, 220.0, pan, true) }
            val muted = if (pan < 0) 1 else 0
            for (frame in 0 until 240) assertEquals(0.0, samples[2 * frame + muted].toDouble(), 1e-7)
            assertTrue(samples.any { kotlin.math.abs(it) > 0.2 })
        }
    }

    @Test fun rampsContinueAcrossSmallerBuffers() {
        val whole = ToneGenerator()
        val split = ToneGenerator()
        val expected = block()
        val first = FloatArray(80 * 2)
        val second = FloatArray(160 * 2)
        whole.render(expected, 880.0, 0.5, true)
        split.render(first, 880.0, 0.5, true)
        split.render(second, 880.0, 0.5, true)
        val combined = first + second
        for (index in expected.indices) assertEquals(expected[index], combined[index])
    }

    @Test fun aNewTargetDuringARampStartsFromTheCurrentValue() {
        val generator = ToneGenerator()
        val first = FloatArray(120 * 2)
        generator.render(first, 220.0, 0.0, true)
        val next = FloatArray(2)
        generator.render(next, 220.0, 0.0, false)
        val gain = 0.125 * (1 - 1 / 240.0)
        assertEquals(gain / sqrt(2.0) * sin(2 * PI * 220 * 120 / 48_000), next[0].toDouble(), 1e-6)
    }

    @Test fun frequencyAndPanAreClampedToTheSpecifiedRange() {
        val low = ToneGenerator()
        val clamped = ToneGenerator()
        val first = block()
        val second = block()
        low.render(first, -50.0, -9.0, true)
        clamped.render(second, 220.0, -1.0, true)
        assertTrue(first.contentEquals(second))
        low.render(first, 90_000.0, 9.0, true)
        clamped.render(second, 1760.0, 1.0, true)
        assertTrue(first.contentEquals(second))
        assertTrue(first.all { it.isFinite() && kotlin.math.abs(it) <= 0.25 })
    }

    @Test fun invalidControlsAndNonStereoBuffersAreRejected() {
        for (bad in listOf(Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY)) {
            assertThrows<IllegalArgumentException> { ToneGenerator().render(block(), bad, 0.0, true) }
            assertThrows<IllegalArgumentException> { ToneGenerator().render(block(), 220.0, bad, true) }
        }
        assertThrows<IllegalArgumentException> { ToneGenerator().render(FloatArray(3), 220.0, 0.0, true) }
    }

    @Test fun prototypeMappingFollowsTheDocumentedFormula() {
        assertEquals(ToneParameters(220.0, -1.0), prototypeTone(0.0, 640))
        assertEquals(ToneParameters(220.0, 0.0), prototypeTone(320.0, 640))
        val right = prototypeTone(640.0, 640)
        assertEquals(1760.0, right.frequencyHz, 1e-9)
        assertEquals(1.0, right.pan, 1e-9)
        assertTrue(prototypeTone(480.0, 640).frequencyHz > prototypeTone(320.0, 640).frequencyHz)
    }

    @Test fun prototypeMappingRejectsInvalidFramesAndClampsOffscreenX() {
        assertEquals(prototypeTone(0.0, 640), prototypeTone(-10.0, 640))
        assertEquals(prototypeTone(640.0, 640), prototypeTone(650.0, 640))
        assertThrows<IllegalArgumentException> { prototypeTone(0.0, 0) }
        assertThrows<IllegalArgumentException> { prototypeTone(Double.NaN, 640) }
    }
}
