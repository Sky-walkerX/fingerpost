package io.github.fingerpost.guidance

import kotlin.math.abs

enum class KeypadLayout { PHONE, CALCULATOR, SCRAMBLED }

/**
 * guidance-spec §10: which keypad is in view, from on-device OCR only. PHONE when the top row reads 1-2-3,
 * CALCULATOR for 7-8-9, SCRAMBLED otherwise; null with fewer than 7 distinct digits.
 */
fun classifyKeypad(tokens: List<OcrToken>): KeypadLayout? {
    val digits = PinGate.keyDigits(tokens)
    if (digits.map { it.text }.toSet().size < 7) return null
    val tol = 0.6 * digits.map { it.h }.sorted()[digits.size / 2]
    val top = digits.minOf { it.cy }
    val row = digits.filter { abs(it.cy - top) <= tol }.sortedBy { it.cx }.joinToString("") { it.text }
    return when (row) {
        "123" -> KeypadLayout.PHONE
        "789" -> KeypadLayout.CALCULATOR
        else -> KeypadLayout.SCRAMBLED
    }
}

/** What the user hears on entry (guidance-spec §10). */
fun KeypadLayout.spoken(): String = when (this) {
    KeypadLayout.PHONE -> "Phone layout. 5 is in the centre."
    KeypadLayout.CALCULATOR -> "Calculator layout. 5 is in the centre."
    KeypadLayout.SCRAMBLED -> "The keys are scrambled. Slide your finger and I'll say each digit."
}

/**
 * guidance-spec §10: the digit under the finger's pad, announced only when it changes and has been stable
 * for [debounceMs]. A key counts as under the pad within [KEY_REACH] digit-heights of its label (initial value).
 * Pure: the caller decides where it is spoken (earphones only) and never logs it.
 */
class DigitUnderFinger(private val debounceMs: Long = 150) {
    private var candidate: String? = null
    private var since = 0L
    private var announced: String? = null

    /** [pad] and [tokens] in the same normalized image space. Returns a digit to speak, or null. */
    fun update(nowMs: Long, pad: Vec2?, tokens: List<OcrToken>): Char? {
        val digit = pad?.let { under(it, PinGate.keyDigits(tokens)) }
        if (digit == null) { candidate = null; return null }
        if (digit != candidate) { candidate = digit; since = nowMs; return null }
        if (nowMs - since < debounceMs || digit == announced) return null
        announced = digit
        return digit.single()
    }

    fun reset() { candidate = null; announced = null }

    private fun under(p: Vec2, digits: List<OcrToken>): String? = digits
        .filter { abs(p.x - it.cx) <= it.w / 2 + KEY_REACH * it.h && abs(p.y - it.cy) <= it.h / 2 + KEY_REACH * it.h }
        .minByOrNull { (p.x - it.cx) * (p.x - it.cx) + (p.y - it.cy) * (p.y - it.cy) }?.text

    companion object { const val KEY_REACH = 1.5 }
}
