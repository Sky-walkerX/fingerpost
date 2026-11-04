package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/** guidance-spec §8 (initial values, 2026-11-04): progress while a live read runs; one automatic re-frame per goal. */
class ReframeAndProgressTest {
    private val still = Strings.get(Key.STILL_READING, Strings.EN)
    private val noScreen = "I can't find the screen. Hold the phone steady and try again."

    private fun locating(waitMs: Long = 65_000L) = GuidanceStateMachine().apply {
        serverWaitMs = waitMs
        handle(GEvent.Start(0)); handle(GEvent.GoalHeard(10, "boil")); handle(GEvent.Frame(20, true, false, null))
    }

    @Test fun aLiveReadSaysStillReadingEvery10Seconds() {
        val s = locating()
        assertEquals(GState.LOCATING, s.state)
        assertEquals(emptyList<Effect>(), s.handle(GEvent.Tick(9_000)))
        assertEquals(listOf(Effect.Say(still, Priority.INFO)), s.handle(GEvent.Tick(10_020)))
        assertEquals(emptyList<Effect>(), s.handle(GEvent.Tick(15_000)))
        assertEquals(listOf(Effect.Say(still, Priority.INFO)), s.handle(GEvent.Tick(20_020)))
        s.handle(GEvent.TargetArrived(21_000, "Found Boil, bottom right."))
        assertTrue(s.handle(GEvent.Tick(31_000)).none { it == Effect.Say(still, Priority.INFO) })
    }

    @Test fun legacyGatewaysKeepTheirShortTimersWithoutProgressSpeech() {
        val s = locating(waitMs = 6_000L)
        assertEquals(listOf(Effect.SendKeyframe(KeyframePurpose.LOCATE)), s.handle(GEvent.Tick(6_020)))
        assertEquals(listOf(Effect.Say(Prompts.LOCATE_FAILED, Priority.STATE)), s.handle(GEvent.Tick(12_020)))
    }

    @Test fun aReframeAskReframesOnceKeepingTheGoalThenAsksNormally() {
        val s = locating()
        assertEquals(listOf(Effect.ToneOff, Effect.Say(noScreen, Priority.STATE)), s.handle(GEvent.AskArrived(5_000, "a1", noScreen, emptyList(), reframe = true)))
        assertEquals(GState.FRAMING, s.state)
        assertEquals(listOf(Effect.SendKeyframe(KeyframePurpose.LOCATE)), s.handle(GEvent.Frame(6_000, true, false, null)))
        assertEquals(GState.LOCATING, s.state)
        assertEquals(listOf(Effect.ToneOff, Effect.Say(noScreen, Priority.STATE), Effect.OpenMic),
            s.handle(GEvent.AskArrived(9_000, "a2", noScreen, emptyList(), reframe = true)))
        assertEquals(GState.LISTENING, s.state)
    }

    @Test fun aNewGoalRestoresTheAutomaticReframe() {
        val s = locating()
        s.handle(GEvent.AskArrived(5_000, "a1", noScreen, emptyList(), reframe = true))
        s.handle(GEvent.Frame(6_000, true, false, null))
        s.handle(GEvent.AskArrived(9_000, "a2", noScreen, emptyList(), reframe = true))
        s.handle(GEvent.GoalHeard(10_000, "timer")); s.handle(GEvent.Frame(10_100, true, false, null))
        s.handle(GEvent.AskArrived(12_000, "a3", noScreen, emptyList(), reframe = true))
        assertEquals(GState.FRAMING, s.state)
    }

    @Test fun anOrdinaryAskStillOpensTheMic() {
        val s = locating()
        assertEquals(listOf(Effect.ToneOff, Effect.Say("Which size?", Priority.STATE), Effect.OpenMic),
            s.handle(GEvent.AskArrived(5_000, "a1", "Which size?", listOf("small"))))
        assertEquals(GState.LISTENING, s.state)
    }

    @Test fun progressSpeechIsTranslated() {
        for (locale in listOf(Strings.EN, Strings.HI, Strings.ES)) assertTrue(Strings.get(Key.STILL_READING, locale).isNotBlank())
        assertTrue(Strings.get(Key.STILL_READING, Strings.HI) != still && Strings.get(Key.STILL_READING, Strings.ES) != still)
    }
}
