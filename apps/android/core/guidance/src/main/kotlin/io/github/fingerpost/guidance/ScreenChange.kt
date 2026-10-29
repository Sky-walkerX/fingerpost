package io.github.fingerpost.guidance

import kotlin.math.abs

/**
 * guidance-spec §9 press evidence #2. Frames are the rectified screen as grayscale in [0,1], 160×90
 * (row-major). mask[i] = true marks hand pixels, which are excluded. Fires once when the mean absolute
 * difference against the reference exceeds τ for 3 consecutive frames.
 */
class ScreenChangeDetector(private val tau: Double = 0.08, private val framesNeeded: Int = 3) {
    private var ref: FloatArray? = null
    private var run = 0
    private var fired = false

    fun setReference(frame: FloatArray) {
        ref = frame.copyOf()
        run = 0
        fired = false
    }

    /** Returns true exactly once per reference, on the frame that completes the run. */
    fun update(frame: FloatArray, mask: BooleanArray): Boolean {
        val reference = ref ?: return false
        if (fired) return false
        var sum = 0.0
        var count = 0
        for (i in reference.indices) {
            if (mask[i]) continue
            sum += abs(frame[i] - reference[i])
            count++
        }
        run = if (count > 0 && sum / count > tau) run + 1 else 0
        if (run >= framesNeeded) {
            fired = true
            return true
        }
        return false
    }

    companion object { const val W = 160; const val H = 90 }
}
