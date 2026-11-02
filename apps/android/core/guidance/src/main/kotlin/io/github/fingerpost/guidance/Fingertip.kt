package io.github.fingerpost.guidance

enum class Handedness { LEFT, RIGHT, UNKNOWN }

/** One detected hand in analysis-frame pixels. tip = landmark 8, dip = landmark 7 (guidance-spec §3). */
data class HandSample(val tip: Vec2, val dip: Vec2, val presence: Double, val hand: Handedness = Handedness.UNKNOWN)

/** pad = p8 − 0.25 · (p8 − p7). */
fun padPoint(tip: Vec2, dip: Vec2): Vec2 = tip - (tip - dip) * 0.25

const val MIN_HAND_PRESENCE = 0.6

/** Hands with presence ≥ 0.6 and a tip inside the frame; the one nearest `targetImg` (or the first) wins. */
fun chooseHand(hands: List<HandSample>, frameW: Int, frameH: Int, targetImg: Vec2?, preferred: Handedness = Handedness.UNKNOWN): HandSample? {
    val valid = hands.filter {
        it.presence >= MIN_HAND_PRESENCE && it.tip.x in 0.0..frameW.toDouble() &&
            it.tip.y in 0.0..frameH.toDouble()
    }
    return valid.minWithOrNull(compareBy<HandSample> { targetImg?.let { target -> (it.tip - target).length } ?: 0.0 }
        .thenBy { if (preferred != Handedness.UNKNOWN && it.hand == preferred) 0 else 1 })
}

/** guidance-spec §3: the pad is "off screen" when it maps outside [−0.15, 1.15] on either axis. */
fun isOffScreen(uv: Vec2): Boolean = uv.x !in -0.15..1.15 || uv.y !in -0.15..1.15
