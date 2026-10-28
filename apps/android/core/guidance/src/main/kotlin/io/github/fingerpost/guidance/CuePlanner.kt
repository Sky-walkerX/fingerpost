package io.github.fingerpost.guidance

import kotlin.math.abs
import kotlin.math.sign

enum class Dir { UP, DOWN, LEFT, RIGHT, FORWARD, BACK }
enum class Orientation { UPRIGHT, FLAT }

/** What to say about one error vector. dirs is empty only when nothing should be spoken. */
data class GuideCue(val dirs: List<Dir>, val magnitude: MagnitudeWord?, val slowDown: Boolean = false)

/**
 * guidance-spec §5 and §6. e = c − pad in iso units (+x right, +y down the screen content).
 * FLAT screens: content "up" is away from the user, so −y → FORWARD and +y → BACK.
 */
class CuePlanner {
    private val flips = ArrayDeque<Long>()
    private var lastSign = 0.0
    private var lastAxisX: Boolean? = null
    private var slowUntilMs = Long.MIN_VALUE
    private var slowAnnounced = false

    fun plan(e: Vec2, orientation: Orientation, nowMs: Long): GuideCue? {
        val mag = e.length
        val axisX = abs(e.x) >= abs(e.y)
        val s = sign(if (axisX) e.x else e.y)
        if (lastAxisX == axisX && lastSign != 0.0 && s != 0.0 && s != lastSign) flips.addLast(nowMs)
        lastAxisX = axisX; if (s != 0.0) lastSign = s
        while (flips.isNotEmpty() && nowMs - flips.first() > 2000) flips.removeFirst()

        var slowDown = false
        if (flips.size >= 2 && !slowAnnounced) { slowDown = true; slowAnnounced = true; slowUntilMs = nowMs + 3000; flips.clear() }
        if (nowMs > slowUntilMs) slowAnnounced = false

        var word = magnitudeWord(mag) ?: return if (slowDown) GuideCue(emptyList(), null, true) else null
        if (nowMs <= slowUntilMs) word = MagnitudeWord.A_LITTLE

        val xDir = if (e.x > 0) Dir.RIGHT else Dir.LEFT
        val yDir = when (orientation) {
            Orientation.UPRIGHT -> if (e.y > 0) Dir.DOWN else Dir.UP
            Orientation.FLAT -> if (e.y > 0) Dir.BACK else Dir.FORWARD
        }
        val dominant = if (axisX) xDir else yDir
        val secondaryMag = if (axisX) abs(e.y) else abs(e.x)
        val dirs = if (secondaryMag >= 0.4 * mag) listOf(dominant, if (axisX) yDir else xDir) else listOf(dominant)
        return GuideCue(dirs, word, slowDown)
    }

    fun reset() { flips.clear(); lastSign = 0.0; lastAxisX = null; slowUntilMs = Long.MIN_VALUE; slowAnnounced = false }
}

/** guidance-spec §6: pitch more than 55° below the horizon → FLAT. */
fun orientationFor(cameraPitchBelowHorizonDeg: Double): Orientation =
    if (cameraPitchBelowHorizonDeg > 55.0) Orientation.FLAT else Orientation.UPRIGHT
