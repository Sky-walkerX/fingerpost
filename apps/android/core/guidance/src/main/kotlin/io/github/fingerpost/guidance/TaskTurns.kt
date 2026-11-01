package io.github.fingerpost.guidance

/** Spoken yes/no for confirm turns (Days 4–7 plan, A4-1). Anything unclear is null: it never accepts a payment. */
object YesNo {
    private val yes = setOf("yes", "yeah", "yep", "haan", "हाँ", "हां", "sí", "si")
    private val no = setOf("no", "nope", "nahin", "नहीं")

    fun parse(text: String, @Suppress("UNUSED_PARAMETER") locale: String = "en"): Boolean? {
        val first = text.trim().lowercase().split(Regex("[\\s,.!?।]+")).firstOrNull { it.isNotEmpty() } ?: return null
        return when (first) {
            in yes -> true
            in no -> false
            else -> null
        }
    }
}

/** English task-turn prompts; Day 4 HI/ES tables use the same keys. */
object TaskPrompts {
    val SAY_YES_OR_NO get() = Strings.get(Key.SAY_YES_OR_NO, Strings.EN)
    val PAYMENT_NOT_CONFIRMED get() = Strings.get(Key.PAYMENT_NOT_CONFIRMED, Strings.EN)
    val CONFIRM_FIRST get() = Strings.get(Key.CONFIRM_FIRST, Strings.EN)
    val LOST_TRACK get() = Strings.get(Key.LOST_TRACK, Strings.EN)
    val ASK_AGAIN_GIVE_UP get() = Strings.get(Key.ASK_AGAIN_GIVE_UP, Strings.EN)
    val DONE get() = Strings.get(Key.DONE, Strings.EN)
}
