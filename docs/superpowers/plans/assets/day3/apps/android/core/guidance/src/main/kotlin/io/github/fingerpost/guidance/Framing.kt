package io.github.fingerpost.guidance

import kotlin.math.abs
import kotlin.math.hypot

/** guidance-spec §8 framing: stable = every corner moves < 1% of the frame diagonal per frame, for 10 frames. */
class QuadStability(private val frames: Int = 10, private val maxMove: Double = 0.01) {
    private var last: List<Vec2>? = null
    private var run = 0
    val stable get() = run >= frames

    fun update(quad: List<Vec2>?, frameW: Int, frameH: Int): Boolean { TODO("D3-T3: implement; the tests describe the behaviour") }
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

    fun evaluate(quad: List<Vec2>?, frameW: Int, frameH: Int): FramingCue { TODO("D3-T3: implement; the tests describe the behaviour") }

    /** Rate-limited: returns the cue to speak now, or null. GOOD is never spoken (the app plays a tick). */
    fun cueToSpeak(quad: List<Vec2>?, frameW: Int, frameH: Int, nowMs: Long): FramingCue? { TODO("D3-T3: implement; the tests describe the behaviour") }
}
