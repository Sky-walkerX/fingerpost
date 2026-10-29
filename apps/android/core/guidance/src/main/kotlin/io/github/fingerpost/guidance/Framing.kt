package io.github.fingerpost.guidance

import kotlin.math.abs
import kotlin.math.hypot

/** guidance-spec §8 framing: stable = every corner moves < 1% of the frame diagonal per frame, for 10 frames. */
class QuadStability(private val frames: Int = 10, private val maxMove: Double = 0.01) {
    private var last: List<Vec2>? = null
    private var run = 0
    val stable get() = run >= frames

    fun update(quad: List<Vec2>?, frameW: Int, frameH: Int): Boolean {
        val previous = last
        last = quad
        if (quad == null || previous == null || previous.size != quad.size) {
            run = 0
            return false
        }
        val limit = maxMove * hypot(frameW.toDouble(), frameH.toDouble())
        run = if (quad.indices.all { hypot(quad[it].x - previous[it].x, quad[it].y - previous[it].y) < limit }) run + 1 else 0
        return stable
    }
}

enum class FramingCue { NO_SCREEN, CUT_LEFT, CUT_RIGHT, CUT_TOP, CUT_BOTTOM, MOVE_CLOSER, MOVE_BACK, MOVE_LEFT, MOVE_RIGHT, MOVE_UP, MOVE_DOWN, GOOD }

/**
 * One cue at most every 1.5 s (GOOD is returned every time, for the soft tick). Order of checks:
 * no quad → area > 85% (too close; checked first because such a quad always touches the 4% margin) →
 * a corner within 4% of an edge (cut off) → area < 15% → centre offset > 15% → GOOD.
 * Directions are where to move the PHONE, in image axes (the app maps them to words).
 */
class FramingCoach(private val intervalMs: Long = 1500) {
    private var lastCueAt = Long.MIN_VALUE / 2

    fun evaluate(quad: List<Vec2>?, frameW: Int, frameH: Int): FramingCue {
        if (quad == null || quad.size < 3) return FramingCue.NO_SCREEN
        val w = frameW.toDouble()
        val h = frameH.toDouble()
        val area = abs(quad.indices.sumOf { i -> val a = quad[i]; val b = quad[(i + 1) % quad.size]; a.x * b.y - b.x * a.y }) / 2 / (w * h)
        if (area > 0.85) return FramingCue.MOVE_BACK
        val mx = 0.04 * w
        val my = 0.04 * h
        if (quad.any { it.x < mx }) return FramingCue.CUT_LEFT
        if (quad.any { it.x > w - mx }) return FramingCue.CUT_RIGHT
        if (quad.any { it.y < my }) return FramingCue.CUT_TOP
        if (quad.any { it.y > h - my }) return FramingCue.CUT_BOTTOM
        if (area < 0.15) return FramingCue.MOVE_CLOSER
        val dx = (quad.sumOf { it.x } / quad.size - w / 2) / w
        val dy = (quad.sumOf { it.y } / quad.size - h / 2) / h
        if (maxOf(abs(dx), abs(dy)) > 0.15) {
            return if (abs(dx) >= abs(dy)) (if (dx > 0) FramingCue.MOVE_RIGHT else FramingCue.MOVE_LEFT)
            else (if (dy > 0) FramingCue.MOVE_DOWN else FramingCue.MOVE_UP)
        }
        return FramingCue.GOOD
    }

    /** Rate-limited: returns the cue to speak now, or null. GOOD is never spoken (the app plays a tick). */
    fun cueToSpeak(quad: List<Vec2>?, frameW: Int, frameH: Int, nowMs: Long): FramingCue? {
        val cue = evaluate(quad, frameW, frameH)
        if (cue == FramingCue.GOOD || nowMs - lastCueAt < intervalMs) return null
        lastCueAt = nowMs
        return cue
    }
}
