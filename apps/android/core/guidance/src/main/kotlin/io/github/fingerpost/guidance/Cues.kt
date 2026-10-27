package io.github.fingerpost.guidance

import kotlin.math.min
import kotlin.math.pow

/** Spoken magnitude qualifier (guidance-spec §5). NONE = say the direction with no qualifier. */
enum class MagnitudeWord { A_LOT, NONE, A_LITTLE }

/** guidance-spec §7: 220 · 2^(3 · (1 − min(e/0.5, 1))) Hz, so 220 Hz far away → 1760 Hz on target. */
fun toneFrequencyHz(errorMag: Double): Double =
    220.0 * 2.0.pow(3.0 * (1.0 - min(errorMag.coerceAtLeast(0.0) / 0.5, 1.0)))

/** guidance-spec §7: clamp(ex / 0.3, −1, 1). Positive = sound on the right = move right. */
fun tonePan(ex: Double): Double = (ex / 0.3).coerceIn(-1.0, 1.0)

/** guidance-spec §5, in screen-height units. null = below 0.03, so tone and haptics only. */
fun magnitudeWord(errorMag: Double): MagnitudeWord? = when {
    errorMag > 0.30 -> MagnitudeWord.A_LOT
    errorMag >= 0.10 -> MagnitudeWord.NONE
    errorMag >= 0.03 -> MagnitudeWord.A_LITTLE
    else -> null
}
