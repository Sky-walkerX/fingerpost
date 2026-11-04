package io.github.fingerpost.guidance

import kotlin.math.abs
import java.util.Locale

/** guidance-spec §7: screen-axis patterns; independent of speech magnitude and phone tilt. */
class DirectionalHaptics {
    private var last = Long.MIN_VALUE / 2
    fun next(error: Vec2, nowMs: Long): List<Long>? {
        val pattern = pattern(error)
        if (pattern.isEmpty() || nowMs - last < interval(error.length)) return null
        last = nowMs
        return pattern
    }
    fun reset() { last = Long.MIN_VALUE / 2 }
    companion object {
        fun pattern(error: Vec2): List<Long> = when {
            !error.x.isFinite() || !error.y.isFinite() || error.length == 0.0 -> emptyList()
            abs(error.x) >= abs(error.y) -> if (error.x < 0) listOf(0,80,80,80) else listOf(0,240)
            error.y < 0 -> listOf(0,80,80,80,80,80)
            else -> listOf(0,240,80,80)
        }
        fun interval(distance: Double): Long = when {
            distance < 0.10 -> 600
            distance < 0.30 -> 900
            else -> 1200
        }
    }
}

data class HapticLesson(val text: String, val pattern: List<Long>)
object HapticTutorial {
    const val durationMs = 20_000L
    const val lessonMs = 4_000L
    fun lessons(locale: Locale) = listOf(
        Key.HAPTIC_LEFT to Vec2(-1.0,0.0), Key.HAPTIC_RIGHT to Vec2(1.0,0.0),
        Key.HAPTIC_UP to Vec2(0.0,-1.0), Key.HAPTIC_DOWN to Vec2(0.0,1.0),
    ).map { (key, vector) -> HapticLesson(Strings.get(key,locale),DirectionalHaptics.pattern(vector)) } +
        HapticLesson(Strings.get(Key.HAPTIC_ON,locale),listOf(0,80,40,80))
}
