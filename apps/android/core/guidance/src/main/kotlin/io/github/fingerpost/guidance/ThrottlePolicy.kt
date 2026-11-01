package io.github.fingerpost.guidance

object ThrottlePolicy {
    /**
     * Thermal and latency frame stride (guidance-spec §12).
     * Returns 1 when status < 2 and inference < 40 ms; 2 when status >= 2 or inference >= 40 ms; 3 when status >= 4.
     */
    fun stride(thermalStatus: Int, recentInferenceMs: Long): Int {
        if (thermalStatus >= 4) return 3
        if (thermalStatus >= 2 || recentInferenceMs >= 40L) return 2
        return 1
    }

    /** Linear interpolation between two 2D vectors. */
    fun interpolate(a: Vec2, b: Vec2, fraction: Double): Vec2 =
        Vec2(a.x + (b.x - a.x) * fraction, a.y + (b.y - a.y) * fraction)

    /** Linear interpolation between two hand samples. */
    fun interpolate(a: HandSample, b: HandSample, fraction: Double): HandSample =
        HandSample(
            tip = interpolate(a.tip, b.tip, fraction),
            dip = interpolate(a.dip, b.dip, fraction),
            presence = (a.presence + (b.presence - a.presence) * fraction).coerceIn(0.0, 1.0)
        )

    /**
     * Interpolates or projects between two hand samples based on timestamps.
     * When t > tB, linearly projects forward.
     */
    fun interpolate(a: HandSample, b: HandSample, tA: Long, tB: Long, t: Long): HandSample {
        if (tB == tA) return b
        val fraction = (t - tA).toDouble() / (tB - tA).toDouble()
        return interpolate(a, b, fraction)
    }

    /** Linear interpolation between two bounding boxes. */
    fun interpolate(a: Bbox, b: Bbox, fraction: Double): Bbox =
        Bbox(
            a.minX + (b.minX - a.minX) * fraction,
            a.minY + (b.minY - a.minY) * fraction,
            a.maxX + (b.maxX - a.maxX) * fraction,
            a.maxY + (b.maxY - a.maxY) * fraction
        )
}

/** Tracks recent hand samples and provides interpolated / extrapolated estimates for skipped frames. */
class HandInterpolator {
    private var prev: Pair<Long, HandSample>? = null
    private var curr: Pair<Long, HandSample>? = null

    fun update(tsMs: Long, sample: HandSample) {
        prev = curr
        curr = tsMs to sample
    }

    fun interpolate(targetTsMs: Long): HandSample? {
        val (tCurr, sCurr) = curr ?: return null
        val (tPrev, sPrev) = prev ?: return sCurr
        if (targetTsMs - tCurr > 200L) return null
        return ThrottlePolicy.interpolate(sPrev, sCurr, tPrev, tCurr, targetTsMs)
    }

    fun reset() {
        prev = null
        curr = null
    }
}

