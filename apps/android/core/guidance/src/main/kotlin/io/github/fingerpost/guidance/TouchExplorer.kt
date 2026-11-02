package io.github.fingerpost.guidance

import java.util.Locale

/** One element of the last layout, in screen-normalized coordinates (u, v in 0..1). */
data class ExploreElement(val id: String, val label: String, val role: String, val polygon: List<Vec2>)

sealed interface ExploreCue {
    /** A new element is under the finger. [role] is the protocol role ("button", "text", …). */
    data class Speak(val label: String, val role: String) : ExploreCue {
        /** Plain text is announced as text, so the user doesn't try to press it. Controls are just their label. */
        fun spoken(locale: Locale): String = if (role == "text") "${Strings.get(Key.TEXT_PREFIX, locale)}: $label" else label
    }
    /** The finger left the element it was on: play the edge earcon. */
    data object Edge : ExploreCue
}

/**
 * Days 4–7 plan, A5-1: touch-explore over the last layout, fully on the phone (no uploads).
 * An element is named once it has been under the finger's pad for [debounceMs] (guidance-spec §11a), and
 * not again until the finger leaves it. Leaving gives an [ExploreCue.Edge] right away.
 */
class TouchExplorer(private val debounceMs: Long = 150) {
    private var current: String? = null
    private var candidate: String? = null
    private var candidateSince = 0L

    fun reset() { current = null; candidate = null }

    fun update(nowMs: Long, padUv: Vec2?, layout: List<ExploreElement>): ExploreCue? {
        if (padUv == null) { candidate = null; return null }
        // Smallest polygon wins, so a button inside a panel is named instead of the panel.
        val under = layout.filter { it.polygon.size >= 3 && pointInPolygon(padUv, it.polygon) }
            .minByOrNull { QuadArea.of(it.polygon) }
        val id = under?.id
        if (id != current && current != null) {
            current = null
            candidate = id; candidateSince = nowMs
            return ExploreCue.Edge
        }
        if (id == null || id == current) { candidate = null; return null }
        if (id != candidate) { candidate = id; candidateSince = nowMs; return null }
        if (nowMs - candidateSince < debounceMs) return null
        current = id; candidate = null
        return ExploreCue.Speak(under.label, under.role)
    }
}

private object QuadArea {
    fun of(poly: List<Vec2>): Double {
        var a = 0.0
        for (i in poly.indices) { val p = poly[i]; val q = poly[(i + 1) % poly.size]; a += p.x * q.y - q.x * p.y }
        return kotlin.math.abs(a) / 2
    }
}

/** "touch explore" in en/hi/es (accents optional). Plain "explore" is the spoken summary, not this. */
fun isTouchExploreCommand(text: String): Boolean {
    val t = java.text.Normalizer.normalize(text.lowercase(), java.text.Normalizer.Form.NFD).replace(Regex("\\p{Mn}+"), "")
    return Regex("\\btouch[\\s-]*explor").containsMatchIn(t) || t.contains("टच") || Regex("\\bexploracion\\s+tactil").containsMatchIn(t)
}
