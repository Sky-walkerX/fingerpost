package io.github.fingerpost.guidance

import java.util.Locale

/** IF-1: user-approved conservative printed-control vocabulary; unknown semantics wait for cloud. */
object ProvisionalTarget {
    private val labels = setOf("boil", "timer", "fan", "cool", "drinks", "burgers", "sides",
        "उबाल", "टाइमर", "पंखा", "ठंडा", "पेय", "बर्गर",
        "hervir", "temporizador", "ventilador", "frío", "bebidas", "hamburguesas")
    fun resolve(goal: String, tokens: List<OcrToken>, tracking: Boolean, pin: Boolean, privateMode: Boolean,
                sensitive: Boolean, intent: String?): OcrToken? {
        if (!tracking || pin || privateMode || sensitive || intent != "guide") return null
        val match = OfflineResolver.resolve(goal,tokens) as? OfflineResult.Match ?: return null
        val token = match.token
        return token.takeIf { normalizeLabel(it.text) in labels && it.w > 0 && it.h > 0 &&
            it.u >= 0 && it.v >= 0 && it.u + it.w <= 1 && it.v + it.h <= 1 }
    }
    fun polygon(t: OcrToken) = listOf(Vec2(t.u,t.v),Vec2(t.u+t.w,t.v),Vec2(t.u+t.w,t.v+t.h),Vec2(t.u,t.v+t.h))
    fun say(t: OcrToken, locale: Locale) = OfflinePhrases.found(t,locale) + " " + Strings.get(Key.PROVISIONAL_CHECKING,locale)
    fun correction(label: String, locale: Locale) = Strings.get(Key.PROVISIONAL_CORRECTION,locale).replace("{label}",label)
}
