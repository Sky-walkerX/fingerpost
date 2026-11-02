package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class SpeechPrivacyTest {
    @Test fun ordinarySpeechUsesTheCloudUntilPrivacyIsRequired() {
        val policy = SpeechPrivacy(false)
        assertEquals(SpeechInput.CLOUD, policy.input(false, false))
        policy.requireLocal()
        assertEquals(SpeechInput.LOCAL, policy.input(false, false))
        assertEquals(SpeechInput.LOCAL, policy.input(true, false))
        assertTrue(policy.localOnly)
    }
    @Test fun privateSessionsUseLocalSpeechBeforeTheFirstLayout() {
        val policy = SpeechPrivacy(true)
        assertEquals(SpeechInput.LOCAL, policy.input(false, false))
        assertEquals(LocalSpeechTurn.GOAL, policy.turn(GState.LISTENING, false, false, "Synthetic goal"))
    }
    @Test fun localSpeechSupportsTaskRepliesAndExploreWithoutCloudAudio() {
        val policy = SpeechPrivacy(true)
        for (state in listOf(GState.ASK, GState.CONFIRM))
            assertEquals(LocalSpeechTurn.REPLY, policy.turn(state, false, false, "yes"))
        assertEquals(LocalSpeechTurn.GOAL, policy.turn(GState.EXPLORING, false, false, "more"))
        assertEquals(LocalSpeechTurn.TOUCH_EXPLORE, policy.turn(GState.EXPLORING, false, false, "touch explore"))
    }
    @Test fun pinBlocksEverySpeechSourceAndLateLocalResults() {
        for (private in listOf(false, true)) for (offline in listOf(false, true)) {
            val policy = SpeechPrivacy(private)
            assertEquals(SpeechInput.NONE, policy.input(offline, true))
            for (state in GState.entries) assertNull(policy.turn(state, offline, true, "Synthetic speech"))
        }
    }
    @Test fun basicModeOnlyAcceptsGoalsAndNeverTurnsAnAnswerIntoACloudTask() {
        val policy = SpeechPrivacy(false)
        assertEquals(LocalSpeechTurn.GOAL, policy.turn(GState.LISTENING, true, false, "Synthetic goal"))
        assertNull(policy.turn(GState.ASK, true, false, "Synthetic answer"))
        assertNull(policy.turn(GState.GUIDING, false, false, "Late synthetic result"))
        assertNull(policy.turn(GState.LISTENING, false, false, "Unexpected local result"))
    }
    @Test fun invalidResultsAreIgnoredBeforeProtocolConstruction() {
        val policy = SpeechPrivacy(true)
        assertNull(policy.turn(GState.LISTENING, false, false, " "))
        assertNull(policy.turn(GState.LISTENING, false, false, "x".repeat(501)))
    }
}
