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

    fun setReference(frame: FloatArray) { TODO("D3-T3: implement; the tests describe the behaviour") }

    /** Returns true exactly once per reference, on the frame that completes the run. */
    fun update(frame: FloatArray, mask: BooleanArray): Boolean { TODO("D3-T3: implement; the tests describe the behaviour") }

    companion object { const val W = 160; const val H = 90 }
}
