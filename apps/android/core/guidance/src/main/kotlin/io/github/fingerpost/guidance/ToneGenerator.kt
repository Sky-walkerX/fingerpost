package io.github.fingerpost.guidance

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

data class ToneParameters(val frequencyHz: Double, val pan: Double)

fun prototypeTone(tipX: Double, frameWidth: Int): ToneParameters {
    require(tipX.isFinite() && frameWidth > 0)
    val x = (tipX / frameWidth).coerceIn(0.0, 1.0)
    return ToneParameters(toneFrequencyHz(1.0 - x), tonePan((x - 0.5) * 0.6))
}

/** One audio thread owns the oscillator; controls are supplied at block boundaries. */
class ToneGenerator {
    private val frequency = Ramp(220.0)
    private val position = Ramp(0.0)
    private val gain = Ramp(0.0)
    private var phase = 0.0

    fun render(stereo: FloatArray, frequencyHz: Double, pan: Double, enabled: Boolean) {
        require(stereo.size % 2 == 0)
        require(frequencyHz.isFinite() && pan.isFinite())
        frequency.target(frequencyHz.coerceIn(220.0, 1760.0))
        position.target(pan.coerceIn(-1.0, 1.0))
        gain.target(if (enabled) AMPLITUDE else 0.0)
        for (frame in 0 until stereo.size / 2) {
            val hz = frequency.next()
            val angle = (position.next() + 1) * PI / 4
            val sample = sin(phase) * gain.next()
            stereo[frame * 2] = (sample * cos(angle)).toFloat()
            stereo[frame * 2 + 1] = (sample * sin(angle)).toFloat()
            phase = (phase + 2 * PI * hz / SAMPLE_RATE) % (2 * PI)
        }
    }

    private class Ramp(private var value: Double) {
        private var target = value
        private var step = 0.0
        private var remaining = 0

        fun target(next: Double) {
            if (next == target) return
            target = next
            remaining = BLOCK_FRAMES
            step = (target - value) / remaining
        }

        fun next(): Double {
            if (remaining > 0) {
                value += step
                if (--remaining == 0) value = target
            }
            return value
        }
    }

    companion object {
        const val SAMPLE_RATE = 48_000
        const val BLOCK_FRAMES = 240
        const val AMPLITUDE = 0.25
    }
}
