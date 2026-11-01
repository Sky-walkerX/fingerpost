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
    const val SAY_YES_OR_NO = "Say yes to pay, or no to cancel."
    const val PAYMENT_NOT_CONFIRMED = "Payment not confirmed."
    const val CONFIRM_FIRST = "I need you to confirm the amount first."
    const val LOST_TRACK = "I lost track. What do you want to do?"
    const val ASK_AGAIN_GIVE_UP = "Tell me what you want to do."
    const val DONE = "Done."
}
