package io.github.fingerpost.guidance

/** One detected hand in analysis-frame pixels. tip = landmark 8, dip = landmark 7 (guidance-spec §3). */
data class HandSample(val tip: Vec2, val dip: Vec2, val presence: Double)

/** pad = p8 − 0.25 · (p8 − p7). */
fun padPoint(tip: Vec2, dip: Vec2): Vec2 = tip - (tip - dip) * 0.25

const val MIN_HAND_PRESENCE = 0.6

/** Hands with presence ≥ 0.6 and a tip inside the frame; the one nearest `targetImg` (or the first) wins. */
fun chooseHand(hands: List<HandSample>, frameW: Int, frameH: Int, targetImg: Vec2?): HandSample? {
    val valid = hands.filter {
        it.presence >= MIN_HAND_PRESENCE && it.tip.x in 0.0..frameW.toDouble() &&
            it.tip.y in 0.0..frameH.toDouble()
    }
    return if (targetImg == null) valid.firstOrNull() else valid.minByOrNull { (it.tip - targetImg).length }
}

/** guidance-spec §3: the pad is "off screen" when it maps outside [−0.15, 1.15] on either axis. */
fun isOffScreen(uv: Vec2): Boolean = uv.x !in -0.15..1.15 || uv.y !in -0.15..1.15
