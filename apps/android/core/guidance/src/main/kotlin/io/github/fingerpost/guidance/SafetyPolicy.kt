package io.github.fingerpost.guidance

/**
 * guidance-spec §11, enforced on the device as well as on the gateway (defense in depth).
 *
 * The device refuses to guide to a pay/confirm/submit element unless the latest confirm of this task was
 * accepted. Acceptance belongs to one confirm id: a newer confirm that has not been answered locks pay again,
 * so a "yes" to an earlier question never unlocks a new payment.
 */
class SafetyPolicy {
    private var latestConfirm: String? = null
    private val accepted = mutableSetOf<String>()

    fun onConfirm(confirmId: String) { latestConfirm = confirmId }

    fun onConfirmReply(confirmId: String, accepted: Boolean) {
        if (confirmId != latestConfirm) return
        if (accepted) this.accepted += confirmId else this.accepted -= confirmId
    }

    /** [confirmIdForTarget] names the confirm the target belongs to when known; otherwise the latest one is used. */
    fun mayGuide(role: String, @Suppress("UNUSED_PARAMETER") elementId: String, confirmIdForTarget: String? = null): Boolean {
        if (role !in SENSITIVE) return true
        val id = confirmIdForTarget ?: latestConfirm ?: return false
        return id == latestConfirm && id in accepted
    }

    /** True when the target should be announced with "I think … but I'm not sure" (spec §11). */
    fun speakUncertain(role: String, confidence: Double, ocrAgrees: Boolean): Boolean =
        if (role == "icon") confidence < ICON_MIN_CONFIDENCE else !ocrAgrees

    fun reset() { latestConfirm = null; accepted.clear() }

    companion object {
        val SENSITIVE = setOf("pay", "confirm", "submit")
        const val ICON_MIN_CONFIDENCE = 0.75
    }
}

/**
 * guidance-spec §10.1, server layer: does this layout put the device in PIN mode? `pin_pad` always does.
 * `payment_entry` does when the screen takes input (keys or an input field) or offers no pay/confirm/submit
 * button; a summary panel ("Total ₹149", "Pay by card") does not, so the amount confirm can happen on it.
 * The local pre-upload gate still checks every frame for a digit grid or PIN text.
 */
fun serverLayoutIsPinScreen(screenType: String, roles: List<String>): Boolean = when (screenType) {
    "pin_pad" -> true
    "payment_entry" -> roles.any { it == "key" || it == "input" } || roles.none { it in SafetyPolicy.SENSITIVE }
    else -> false
}
