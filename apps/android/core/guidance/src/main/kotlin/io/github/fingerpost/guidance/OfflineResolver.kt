package io.github.fingerpost.guidance

import java.util.Locale

sealed interface OfflineResult {
    data class Match(val token: OcrToken) : OfflineResult
    data class Ambiguous(val tokens: List<OcrToken>) : OfflineResult
    data object None : OfflineResult
    /** The goal names an icon (wifi, power, …) that has no printed word: only the cloud can find it. */
    data object IconGoal : OfflineResult
}

/**
 * Days 4–7 plan, A6-1: offline basic mode resolves the goal against on-device OCR only, with the same rules
 * as the gateway's resolveByText (services/gateway/src/resolve/match.ts): exact name first, otherwise a
 * token-set ratio ≥ 0.8 where a runner-up within 0.05 makes it ambiguous. Tokens without letters (digits,
 * prices, PIN keys) are never targets. An icon goal is refused unless the icon's word is printed exactly.
 */
object OfflineResolver {
    private val filler = setOf("press", "tap", "touch", "push", "click", "select", "choose", "the", "a", "an", "button", "key",
        "please", "on", "option", "दबाएं", "दबाओ", "बटन", "pulsa", "presiona", "toca", "el", "la", "botón", "boton")
    private val icons = setOf("wifi", "wi fi", "power", "settings", "back arrow", "home", "volume",
        "वाईफाई", "पावर", "सेटिंग्स", "होम", "वॉल्यूम", "encendido", "ajustes", "configuración", "inicio", "volumen")

    fun goalCore(goal: String): String = normalizeLabel(goal).split(' ').filter { it.isNotEmpty() && it !in filler }.joinToString(" ")

    private fun hasLetter(s: String) = s.any { it.isLetter() }

    fun resolve(goal: String, tokens: List<OcrToken>): OfflineResult {
        val core = goalCore(goal)
        if (core.isEmpty() || !hasLetter(core)) return OfflineResult.None
        val named = tokens.filter { hasLetter(it.text) }
        val exact = named.filter { normalizeLabel(it.text) == core }
        if (exact.size > 1) return OfflineResult.Ambiguous(exact)
        if (exact.size == 1) return OfflineResult.Match(exact[0])
        if (core in icons) return OfflineResult.IconGoal
        val scored = named.map { it to tokenSetRatio(core, it.text) }.filter { it.second >= 0.8 }.sortedByDescending { it.second }
        val best = scored.firstOrNull() ?: return OfflineResult.None
        val close = scored.filter { it.second >= best.second - 0.05 }.map { it.first }
        return if (close.size > 1) OfflineResult.Ambiguous(close) else OfflineResult.Match(best.first)
    }

    /** What basic mode can read, for "I can see …": words only, each once, in reading order as OCR gave them. */
    fun visibleLabels(tokens: List<OcrToken>, max: Int = 5): List<String> {
        val seen = mutableSetOf<String>()
        return tokens.filter { hasLetter(it.text) && seen.add(normalizeLabel(it.text)) }.take(max).map { it.text.trim() }
    }
}

/** Spoken text for basic mode, in the session's locale. */
object OfflinePhrases {
    /** "bottom right" … "middle", the same thirds as the gateway's describePosition. */
    fun position(t: OcrToken, locale: Locale): String {
        val row = when { t.cy < 1.0 / 3 -> Key.POS_TOP; t.cy > 2.0 / 3 -> Key.POS_BOTTOM; else -> Key.POS_MIDDLE }
        val col = when { t.cx < 1.0 / 3 -> Key.POS_LEFT; t.cx > 2.0 / 3 -> Key.POS_RIGHT; else -> null }
        val r = Strings.get(row, locale)
        return if (col == null) r else Strings.get(Key.POS_FORMAT, locale).replace("{row}", r).replace("{col}", Strings.get(col, locale))
    }

    fun found(t: OcrToken, locale: Locale) =
        Strings.get(Key.OFFLINE_FOUND, locale).replace("{label}", t.text.trim()).replace("{position}", position(t, locale))

    fun which(candidates: List<OcrToken>, locale: Locale) =
        Strings.get(Key.OFFLINE_WHICH, locale).replace("{a}", candidates[0].text.trim()).replace("{b}", candidates[1].text.trim())

    fun notFound(goal: String, visible: List<String>, locale: Locale): String {
        if (visible.isEmpty()) return Strings.get(Key.OFFLINE_NOT_FOUND_EMPTY, locale).replace("{goal}", goal)
        val list = if (visible.size == 1) visible[0] else visible.dropLast(1).joinToString(", ") + " ${Strings.get(Key.AND, locale)} " + visible.last()
        return Strings.get(Key.OFFLINE_NOT_FOUND, locale).replace("{goal}", goal).replace("{list}", list)
    }
}
