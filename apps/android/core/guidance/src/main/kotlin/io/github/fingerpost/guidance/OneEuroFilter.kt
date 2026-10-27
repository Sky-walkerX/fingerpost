package io.github.fingerpost.guidance

import kotlin.math.PI
import kotlin.math.abs

/** One Euro filter (Casiez et al., CHI 2012). Defaults from guidance-spec §3. Time in seconds. */
class OneEuroFilter(
    private val minCutoff: Double = 1.0,
    private val beta: Double = 0.007,
    private val dCutoff: Double = 1.0,
) {
    private var xPrev = 0.0
    private var dxPrev = 0.0
    private var tPrev = Double.NaN

    private fun alpha(cutoff: Double, dt: Double): Double {
        val tau = 1.0 / (2 * PI * cutoff)
        return 1.0 / (1.0 + tau / dt)
    }

    fun filter(x: Double, tSeconds: Double): Double {
        if (tPrev.isNaN()) { xPrev = x; dxPrev = 0.0; tPrev = tSeconds; return x }
        val dt = (tSeconds - tPrev).takeIf { it > 0 } ?: return xPrev
        val dx = (x - xPrev) / dt
        val dxHat = dxPrev + alpha(dCutoff, dt) * (dx - dxPrev)
        val cutoff = minCutoff + beta * abs(dxHat)
        val xHat = xPrev + alpha(cutoff, dt) * (x - xPrev)
        xPrev = xHat; dxPrev = dxHat; tPrev = tSeconds
        return xHat
    }

    fun reset() { tPrev = Double.NaN }
}
