package io.github.fingerpost.guidance

import kotlin.math.abs

enum class PinGateReason { NONE, DIGIT_GRID, PIN_TEXT }

/**
 * guidance-spec §10.1, run on every frame before it may be uploaded. Blocks when OCR shows a keypad
 * (≥ 7 distinct single digits whose centres form 3–4 rows × 3 columns) or PIN wording. It fails closed:
 * phone-key letters ("2 ABC") and OCR-merged rows ("1 2 3") still count as digits, and stray digits
 * elsewhere on screen can't hide a keypad (only columns holding ≥ 2 digits form the grid).
 */
object PinGate {
    private val pinText = Regex("(?U)\\b(pin|enter pin|पिन|clave|nip|passcode|password|contraseña|पासवर्ड)\\b", RegexOption.IGNORE_CASE)
    private val keyLabel = Regex("^[0-9][A-Za-z]{0,4}$")

    fun check(tokens: List<OcrToken>): PinGateReason {
        if (tokens.any { pinText.containsMatchIn(it.text) }) return PinGateReason.PIN_TEXT
        val digits = tokens.flatMap(::digitTokens)
        if (digits.map { it.text }.toSet().size < 7) return PinGateReason.NONE
        val tol = 0.6 * digits.map { it.h }.sorted()[digits.size / 2]
        val columns = groups(digits, tol * 1.5) { it.cx }.filter { it.size >= 2 }
        val grid = columns.flatten()
        if (columns.size != 3 || grid.map { it.text }.toSet().size < 7) return PinGateReason.NONE
        return if (cluster(grid.map { it.cy }, tol) in 3..4) PinGateReason.DIGIT_GRID else PinGateReason.NONE
    }

    /** One token per key digit: splits OCR-merged words across the box and drops phone-key letters. */
    private fun digitTokens(t: OcrToken): List<OcrToken> {
        val words = t.text.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        if (words.isEmpty()) return emptyList()
        val step = t.w / words.size
        return words.mapIndexedNotNull { i, word ->
            if (keyLabel.matches(word) && (word.length == 1 || words.size <= 2)) OcrToken(word.take(1), t.u + i * step, t.v, step, t.h) else null
        }
    }

    private fun <T> groups(items: List<T>, tol: Double, key: (T) -> Double): List<List<T>> {
        val out = ArrayList<MutableList<T>>()
        var last = Double.NaN
        for (item in items.sortedBy(key)) {
            if (out.isEmpty() || abs(key(item) - last) > tol) out += mutableListOf<T>()
            out.last() += item
            last = key(item)
        }
        return out
    }

    /** Number of 1-D clusters when values closer than tol (to the previous value) join a cluster. */
    fun cluster(values: List<Double>, tol: Double): Int {
        val s = values.sorted()
        var n = if (s.isEmpty()) 0 else 1
        for (i in 1 until s.size) if (abs(s[i] - s[i - 1]) > tol) n++
        return n
    }
}
