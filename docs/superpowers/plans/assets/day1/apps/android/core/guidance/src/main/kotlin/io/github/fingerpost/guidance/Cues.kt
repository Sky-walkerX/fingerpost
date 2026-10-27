package io.github.fingerpost.guidance

import kotlin.math.min
import kotlin.math.pow

/** Spoken magnitude qualifier (guidance-spec §5). NONE = say the direction with no qualifier. */
enum class MagnitudeWord { A_LOT, NONE, A_LITTLE }

/** guidance-spec §7: 220 · 2^(3 · (1 − min(e/0.5, 1))) Hz, so 220 Hz far away → 1760 Hz on target. */
fun toneFrequencyHz(errorMag: Double): Double = TODO("D1-T7: implement; the tests describe the behaviour")

/** guidance-spec §7: clamp(ex / 0.3, −1, 1). Positive = sound on the right = move right. */
fun tonePan(ex: Double): Double = TODO("D1-T7: implement; the tests describe the behaviour")

/** guidance-spec §5, in screen-height units. null = below 0.03, so tone and haptics only. */
fun magnitudeWord(errorMag: Double): MagnitudeWord? = TODO("D1-T7: implement; the tests describe the behaviour")
