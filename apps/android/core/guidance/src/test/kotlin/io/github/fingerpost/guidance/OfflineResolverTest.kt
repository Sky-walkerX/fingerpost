package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

/** Days 4–7 plan, A6-1: offline basic mode resolves a spoken goal against on-device OCR only (guidance-spec §11b). */
class OfflineResolverTest {
    private fun t(text: String, u: Double = 0.1, v: Double = 0.1) = OcrToken(text, u, v, 0.2, 0.1)
    private val panel = listOf(t("Timer", 0.1, 0.8), t("Power", 0.4, 0.8), t("Start", 0.7, 0.8), t("Total ₹149", 0.1, 0.1))

    @Test fun textGoalMatchesOcrToken() {
        assertEquals(OfflineResult.Match(panel[2]), OfflineResolver.resolve("press the start button", panel))
        assertEquals(OfflineResult.Match(panel[0]), OfflineResolver.resolve("timer", panel))
    }

    @Test fun fuzzyGoalMatchesTheOnlyCloseToken() {
        val tokens = listOf(t("Start order"), t("Help"))
        assertEquals(OfflineResult.Match(tokens[0]), OfflineResolver.resolve("start", tokens))
    }

    @Test fun ambiguousListsBoth() {
        val tokens = listOf(t("Start order"), t("Start timer"), t("Help"))
        assertEquals(OfflineResult.Ambiguous(tokens.take(2)), OfflineResolver.resolve("start", tokens))
        val twice = listOf(t("Start", 0.1), t("Start", 0.7))
        assertEquals(OfflineResult.Ambiguous(twice), OfflineResolver.resolve("start", twice))
    }

    @Test fun exactNameBeatsALongerLabel() {
        val tokens = listOf(t("Quick start"), t("Start"))
        assertEquals(OfflineResult.Match(tokens[1]), OfflineResolver.resolve("start", tokens))
    }

    @Test fun iconGoalSaysCloudNeeded() {
        for (goal in listOf("wifi", "press the wi-fi button", "power", "settings", "back arrow", "home", "volume", "सेटिंग्स", "ajustes"))
            assertEquals(OfflineResult.IconGoal, OfflineResolver.resolve(goal, listOf(t("Start"), t("Home made pizza"), t("Volume 2"))), goal)
    }

    @Test fun anIconWordThatIsPrintedAsAButtonStillMatches() {
        assertEquals(OfflineResult.Match(panel[1]), OfflineResolver.resolve("power", panel))
    }

    @Test fun ignoresDigitsInPinGate() {
        val keypad = (1..9).map { t(it.toString(), 0.1 * it, 0.5) } + t("Cancel", 0.1, 0.9)
        assertEquals(OfflineResult.None, OfflineResolver.resolve("5", keypad))
        assertEquals(OfflineResult.None, OfflineResolver.resolve("press five", keypad))
        assertEquals(OfflineResult.None, OfflineResolver.resolve("149", panel))
        assertEquals(OfflineResult.Match(keypad.last()), OfflineResolver.resolve("cancel", keypad))
    }

    @Test fun noMatchOrEmptyGoalIsNone() {
        assertEquals(OfflineResult.None, OfflineResolver.resolve("pay by card", panel))
        assertEquals(OfflineResult.None, OfflineResolver.resolve("press the button", panel))
        assertEquals(OfflineResult.None, OfflineResolver.resolve("start", emptyList()))
    }

    @Test fun hindiAndSpanishGoals() {
        val tokens = listOf(t("शुरू"), t("Cancelar"))
        assertEquals(OfflineResult.Match(tokens[0]), OfflineResolver.resolve("शुरू दबाएं", tokens))
        assertEquals(OfflineResult.Match(tokens[1]), OfflineResolver.resolve("pulsa cancelar", tokens))
    }

    @Test fun visibleLabelsSkipDigitsAndDuplicates() {
        assertEquals(listOf("Timer", "Power", "Start", "Total ₹149"), OfflineResolver.visibleLabels(panel + t("5") + t("start")))
        assertEquals(3, OfflineResolver.visibleLabels(panel, max = 3).size)
    }

    @Test fun positionWordsMatchTheGateway() {
        assertEquals("bottom right", OfflinePhrases.position(t("Start", 0.7, 0.8), Strings.EN))
        assertEquals("top left", OfflinePhrases.position(t("A", 0.0, 0.0), Strings.EN))
        assertEquals("middle", OfflinePhrases.position(t("A", 0.4, 0.45), Strings.EN))
        assertEquals("abajo, a la derecha", OfflinePhrases.position(t("Start", 0.7, 0.8), Strings.ES))
        assertEquals("नीचे दाईं ओर", OfflinePhrases.position(t("Start", 0.7, 0.8), Strings.HI))
    }

    @Test fun spokenPhrases() {
        assertEquals("Found Start, bottom right.", OfflinePhrases.found(panel[2], Strings.EN))
        assertEquals("I see Start order and Start timer. Which one?", OfflinePhrases.which(listOf(t("Start order"), t("Start timer"), t("X")), Strings.EN))
        assertEquals("I can't find pay by card. I can see Timer, Power and Start.", OfflinePhrases.notFound("pay by card", listOf("Timer", "Power", "Start"), Strings.EN))
        assertEquals("I can't find pay by card. Point the phone at the screen.", OfflinePhrases.notFound("pay by card", emptyList(), Strings.EN))
    }
}
