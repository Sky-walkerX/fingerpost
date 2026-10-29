package io.github.fingerpost.guidance

import java.text.Normalizer

/** One on-device OCR token, box in screen-normalized units (u, v, w, h). */
data class OcrToken(val text: String, val u: Double, val v: Double, val w: Double, val h: Double) {
    val cx get() = u + w / 2
    val cy get() = v + h / 2
}

/** Same normalization as the gateway's normalizeLabel: NFKC, lowercase, punctuation and symbols → space. */
fun normalizeLabel(s: String): String =
    Normalizer.normalize(s, Normalizer.Form.NFKC).lowercase()
        .replace(Regex("[\\p{P}\\p{S}]+"), " ").replace(Regex("\\s+"), " ").trim()

/** Same as the gateway's tokenSetRatio (services/gateway/src/resolve/match.ts). */
fun tokenSetRatio(a: String, b: String): Double {
    val x = normalizeLabel(a).split(' ').filter { it.isNotEmpty() }.toSet()
    val y = normalizeLabel(b).split(' ').filter { it.isNotEmpty() }.toSet()
    if (x.isEmpty() || y.isEmpty()) return 0.0
    val inter = x.count { it in y }
    if (inter == minOf(x.size, y.size)) return 1.0
    return 2.0 * inter / (x.size + y.size)
}

/**
 * guidance-spec §11: a text target is trusted only if on-device OCR inside its box agrees with the server label.
 * Tokens count as inside when their centre is inside the target box.
 */
fun twoSourceAgree(label: String, box: Bbox, tokens: List<OcrToken>): Boolean {
    val inside = tokens.filter { it.cx in box.minX..box.maxX && it.cy in box.minY..box.maxY }
    if (inside.isEmpty()) return false
    return tokenSetRatio(label, inside.joinToString(" ") { it.text }) >= 0.8
}
