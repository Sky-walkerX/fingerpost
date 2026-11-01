package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/** guidance-spec §11, device side (Days 4–7 plan, A4-2). */
class SafetyPolicyTest {
    @Test fun payRefusedWithoutAcceptedConfirm() {
        val p = SafetyPolicy()
        for (role in listOf("pay", "confirm", "submit")) assertFalse(p.mayGuide(role, "e1"), role)
        assertTrue(p.mayGuide("button", "e1"))
        p.onConfirm("c-1")
        assertFalse(p.mayGuide("pay", "e1"))
        p.onConfirmReply("c-1", accepted = false)
        assertFalse(p.mayGuide("pay", "e1"))
        p.onConfirmReply("c-1", accepted = true)
        assertTrue(p.mayGuide("pay", "e1"))
    }

    @Test fun acceptanceIsPerConfirmId() {
        val p = SafetyPolicy()
        p.onConfirm("c-1"); p.onConfirmReply("c-1", true)
        assertTrue(p.mayGuide("pay", "e1"))
        // A new confirm locks pay again until it is answered; a late yes to the old one changes nothing.
        p.onConfirm("c-2")
        assertFalse(p.mayGuide("pay", "e2"))
        p.onConfirmReply("c-1", true)
        assertFalse(p.mayGuide("pay", "e2"))
        assertFalse(p.mayGuide("pay", "e2", confirmIdForTarget = "c-1"))
        p.onConfirmReply("c-2", true)
        assertTrue(p.mayGuide("pay", "e2"))
        p.reset()
        assertFalse(p.mayGuide("pay", "e2"))
    }

    @Test fun iconBelow075SpeaksUncertainty() {
        val p = SafetyPolicy()
        assertTrue(p.speakUncertain("icon", 0.74, ocrAgrees = true))
        assertFalse(p.speakUncertain("icon", 0.75, ocrAgrees = false))
    }

    @Test fun textMismatchSpeaksUncertainty() {
        val p = SafetyPolicy()
        assertTrue(p.speakUncertain("button", 0.99, ocrAgrees = false))
        assertFalse(p.speakUncertain("button", 0.2, ocrAgrees = true))
    }

    @Test fun serverPinLayerSparesThePaySummaryPanel() {
        assertTrue(serverLayoutIsPinScreen("pin_pad", listOf("pay")))
        assertTrue(serverLayoutIsPinScreen("payment_entry", listOf("key", "key", "submit")))
        assertTrue(serverLayoutIsPinScreen("payment_entry", listOf("input", "pay")))
        assertTrue(serverLayoutIsPinScreen("payment_entry", listOf("text", "button")))
        assertFalse(serverLayoutIsPinScreen("payment_entry", listOf("text", "cancel", "pay")))
        assertFalse(serverLayoutIsPinScreen("menu", listOf("key")))
    }
}
