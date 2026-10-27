package io.github.fingerpost.guidance

/** One detected hand in analysis-frame pixels. tip = landmark 8, dip = landmark 7 (guidance-spec §3). */
data class HandSample(val tip: Vec2, val dip: Vec2, val presence: Double)

/** pad = p8 − 0.25 · (p8 − p7). */
fun padPoint(tip: Vec2, dip: Vec2): Vec2 = TODO("D2-T2: implement; the tests describe the behaviour")

const val MIN_HAND_PRESENCE = 0.6

/** Hands with presence ≥ 0.6 and a tip inside the frame; the one nearest `targetImg` (or the first) wins. */
fun chooseHand(hands: List<HandSample>, frameW: Int, frameH: Int, targetImg: Vec2?): HandSample? { TODO("D2-T2: implement; the tests describe the behaviour") }

/** guidance-spec §3: the pad is "off screen" when it maps outside [−0.15, 1.15] on either axis. */
fun isOffScreen(uv: Vec2): Boolean = TODO("D2-T2: implement; the tests describe the behaviour")
