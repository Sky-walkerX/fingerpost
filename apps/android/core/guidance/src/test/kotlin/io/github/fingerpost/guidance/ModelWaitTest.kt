package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class ModelWaitTest {
    private fun locating() = GuidanceStateMachine().apply {
        serverWaitMs = 65_000
        handle(GEvent.Start(0)); handle(GEvent.GoalHeard(0, "synthetic")); handle(GEvent.Frame(0, true, false, null))
    }
    /** While the cloud works the only permitted effect is the info-priority progress line (no upload, no press prompt). */
    private fun onlyProgress(effects: List<Effect>) =
        effects.all { it == Effect.Say(Strings.get(Key.STILL_READING, Strings.EN), Priority.INFO) }
    @Test fun liveWaitDoesNotUploadRetriesAtSixSecondsAndAcceptsSlowTargets() {
        val state = locating()
        assertTrue(state.handle(GEvent.Tick(6_000)).isEmpty())
        assertTrue(onlyProgress(state.handle(GEvent.Tick(44_000))))
        state.handle(GEvent.TargetArrived(45_000, "Synthetic target"))
        assertEquals(GState.GUIDING, state.state)
    }
    @Test fun anUnresponsiveServerStillHasABoundedRetry() {
        val state = locating()
        assertTrue(onlyProgress(state.handle(GEvent.Tick(64_999))))
        assertEquals(listOf(Effect.SendKeyframe(KeyframePurpose.LOCATE)), state.handle(GEvent.Tick(65_000)))
        state.handle(GEvent.Tick(130_000))
        assertEquals(GState.FRAMING, state.state)
    }
    @Test fun verifyDoesNotTellTheUserToPressAgainWhileTheCloudIsStillWorking() {
        val state = locating()
        state.handle(GEvent.TargetArrived(100, "Synthetic target"))
        repeat(6) { state.handle(GEvent.Frame(120L + it * 5, true, true, Zone.ON)) }
        assertEquals(GState.ON_TARGET, state.state)
        state.handle(GEvent.PressDetected(200, Evidence.SIM))
        assertTrue(state.handle(GEvent.Tick(4_200)).isEmpty())
        assertEquals(GState.VERIFYING, state.state)
        state.handle(GEvent.VerifyArrived(44_000, VerifyResult.OK, "Synthetic done"))
        assertEquals(GState.DONE, state.state)
    }
    @Test fun exploreAndNextTaskTurnUseTheSameAdvertisedBudget() {
        val state = locating()
        state.handle(GEvent.IntentArrived(1, "explore"))
        assertTrue(state.handle(GEvent.Tick(6_001)).isEmpty())
        assertEquals(GState.EXPLORING, state.state)
        val task = locating()
        task.handle(GEvent.IntentArrived(1, "task")); task.handle(GEvent.TargetArrived(2, "Synthetic"))
        repeat(6) { task.handle(GEvent.Frame(10L + it * 5, true, true, Zone.ON)) }
        assertEquals(GState.ON_TARGET, task.state)
        task.handle(GEvent.PressDetected(100, Evidence.SIM)); task.handle(GEvent.VerifyArrived(104, VerifyResult.OK, "Synthetic"))
        assertTrue(task.handle(GEvent.Tick(6_104)).isEmpty())
        assertEquals(GState.AWAIT_NEXT, task.state)
    }
    @Test fun negotiatedWaitIsClampedAndLegacyDefaultsStayUnchanged() {
        val state = GuidanceStateMachine()
        assertEquals(6_000L, state.serverWaitMs)
        state.serverWaitMs = Long.MAX_VALUE; assertEquals(65_000L, state.serverWaitMs)
        state.serverWaitMs = -1; assertEquals(6_000L, state.serverWaitMs)
    }
}
