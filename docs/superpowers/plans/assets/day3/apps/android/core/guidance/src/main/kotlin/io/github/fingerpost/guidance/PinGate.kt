package io.github.fingerpost.guidance

import kotlin.math.abs

enum class PinGateReason { NONE, DIGIT_GRID, PIN_TEXT }

/**
 * guidance-spec §10.1, run on every frame before it may be uploaded. Blocks when OCR shows a keypad
 * (≥ 7 distinct single digits whose centres form 3–4 rows × 3 columns) or PIN wording.
 */
object PinGate {
    private val pinText = Regex("(?U)\\b(pin|enter pin|पिन|clave|nip)\\b", RegexOption.IGNORE_CASE)

    fun check(tokens: List<OcrToken>): PinGateReason {
        if (tokens.any { pinText.containsMatchIn(it.text) }) return PinGateReason.PIN_TEXT
        val digits = tokens.filter { it.text.trim().length == 1 && it.text.trim()[0] in '0'..'9' }
        if (digits.map { it.text.trim() }.toSet().size < 7) return PinGateReason.NONE
        val tol = 0.6 * digits.map { it.h }.sorted()[digits.size / 2]
        val rows = cluster(digits.map { it.cy }, tol)
        val cols = cluster(digits.map { it.cx }, tol * 1.5)
        return if (rows in 3..4 && cols == 3) PinGateReason.DIGIT_GRID else PinGateReason.NONE
    }

    /** Number of 1-D clusters when values closer than tol (to the previous value) join a cluster. */
    fun cluster(values: List<Double>, tol: Double): Int {
        val s = values.sorted()
        var n = if (s.isEmpty()) 0 else 1
        for (i in 1 until s.size) if (abs(s[i] - s[i - 1]) > tol) n++
        return n
    }
}
