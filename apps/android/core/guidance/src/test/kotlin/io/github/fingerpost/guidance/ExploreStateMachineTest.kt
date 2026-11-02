package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/** Days 4–7 plan, A5-1 and "Explore turn": EXPLORING and TOUCH_EXPLORE with guidance-spec §8 timeouts. */
class ExploreStateMachineTest {
    private val m = GuidanceStateMachine()
    private fun says(effects: List<Effect>) = effects.filterIsInstance<Effect.Say>().map { it.text }
    private fun keyframes(effects: List<Effect>) = effects.filterIsInstance<Effect.SendKeyframe>().map { it.purpose }

    /** Start → goal → goal.ack{explore} → stable frame: the device asks for a summary, not a target. */
    private fun exploring(now: Long = 0): List<Effect> {
        m.handle(GEvent.Start(now))
        m.handle(GEvent.GoalHeard(now, "what's on the screen"))
        m.handle(GEvent.IntentArrived(now, "explore"))
        return m.handle(GEvent.Frame(now, true, false, null))
    }

    @Test fun exploreIntentSendsExploreKeyframe() {
        val out = exploring()
        assertEquals(listOf(Effect.SendKeyframe(KeyframePurpose.EXPLORE)), out)
        assertEquals(GState.EXPLORING, m.state)
    }

    @Test fun exploreIntentAfterALocateKeyframeSwitchesWithoutAnotherUpload() {
        m.handle(GEvent.Start(0)); m.handle(GEvent.GoalHeard(0, "what's on the screen"))
        assertEquals(listOf(Effect.SendKeyframe(KeyframePurpose.LOCATE)), m.handle(GEvent.Frame(10, true, false, null)))
        val out = m.handle(GEvent.IntentArrived(20, "explore"))
        assertEquals(GState.EXPLORING, m.state)
        assertTrue(keyframes(out).isEmpty())
    }

    @Test fun summaryOpensTheMicForMore() {
        exploring()
        assertEquals(listOf(Effect.OpenMic), m.handle(GEvent.ExploreSaid(1_000)))
        assertEquals(GState.EXPLORING, m.state)
        assertTrue(m.handle(GEvent.UserSaid(3_000, "more")).isEmpty())
        assertEquals(GState.EXPLORING, m.state)
    }

    @Test fun noSummaryRetriesOnceAfter6sThenFails() {
        exploring()
        assertTrue(m.handle(GEvent.Tick(5_999)).isEmpty())
        assertEquals(listOf(KeyframePurpose.EXPLORE), keyframes(m.handle(GEvent.Tick(6_000))))
        val failed = m.handle(GEvent.Tick(12_000))
        assertEquals(listOf(Strings.get(Key.LOCATE_FAILED)), says(failed))
        assertEquals(GState.FRAMING, m.state)
        assertEquals(listOf(Effect.SendKeyframe(KeyframePurpose.EXPLORE)), m.handle(GEvent.Frame(12_100, true, false, null)))
    }

    @Test fun idleAfterSummaryHintsOnceAfter12sThenEnds() {
        exploring()
        m.handle(GEvent.ExploreSaid(1_000))
        assertTrue(m.handle(GEvent.Tick(12_999)).isEmpty())
        val hint = m.handle(GEvent.Tick(13_000))
        assertEquals(listOf(Strings.get(Key.EXPLORE_HINT)), says(hint))
        assertTrue(Effect.OpenMic in hint)
        assertTrue(keyframes(hint).isEmpty())
        val end = m.handle(GEvent.Tick(25_000))
        assertTrue(Effect.CloseMic in end)
        assertEquals(listOf(Strings.get(Key.GIVE_UP_LISTENING)), says(end))
        assertEquals(GState.IDLE, m.state)
    }

    @Test fun moreRepliesKeepTheSessionAlive() {
        exploring()
        m.handle(GEvent.ExploreSaid(1_000))
        m.handle(GEvent.UserSaid(10_000, "more"))
        m.handle(GEvent.ExploreSaid(10_500))
        assertTrue(m.handle(GEvent.Tick(22_499)).isEmpty())
        assertEquals(GState.EXPLORING, m.state)
    }

    @Test fun aNewGuideGoalWhileExploringLocates() {
        exploring()
        m.handle(GEvent.ExploreSaid(1_000))
        m.handle(GEvent.UserSaid(2_000, "press drinks"))
        val out = m.handle(GEvent.IntentArrived(2_100, "guide"))
        assertEquals(listOf(Effect.CloseMic, Effect.SendKeyframe(KeyframePurpose.LOCATE)), out)
        assertEquals(GState.LOCATING, m.state)
        assertFalse(m.taskIntent)
    }

    @Test fun aNewTaskGoalWhileExploringLocatesAsATask() {
        exploring()
        m.handle(GEvent.ExploreSaid(1_000))
        m.handle(GEvent.IntentArrived(2_100, "task"))
        assertEquals(GState.LOCATING, m.state)
        assertTrue(m.taskIntent)
    }

    @Test fun exploreAgainAsksForAFreshSummary() {
        exploring()
        m.handle(GEvent.ExploreSaid(1_000))
        val out = m.handle(GEvent.IntentArrived(2_000, "explore"))
        assertEquals(listOf(Effect.CloseMic, Effect.SendKeyframe(KeyframePurpose.EXPLORE)), out)
        assertEquals(GState.EXPLORING, m.state)
    }

    @Test fun touchExploreNeedsAReadScreen() {
        exploring()
        val out = m.handle(GEvent.TouchExploreRequested(500, hasLayout = false))
        assertEquals(listOf(Strings.get(Key.TOUCH_EXPLORE_NEEDS_SCREEN)), says(out))
        assertEquals(GState.EXPLORING, m.state)
    }

    @Test fun touchExploreIsLocalAndNeverUploads() {
        exploring()
        m.handle(GEvent.ExploreSaid(1_000))
        val on = m.handle(GEvent.TouchExploreRequested(2_000, hasLayout = true))
        assertEquals(GState.TOUCH_EXPLORE, m.state)
        assertTrue(Effect.CloseMic in on)
        assertTrue(Effect.ToneOff in on)
        assertEquals(listOf(Strings.get(Key.TOUCH_EXPLORE_ON)), says(on))
        val later = mutableListOf<Effect>()
        for (t in 2_100L..120_000L step 100) later += m.handle(GEvent.Tick(t))
        later += m.handle(GEvent.IntentArrived(60_000, "explore"))
        later += m.handle(GEvent.Frame(60_100, true, true, null))
        assertTrue(keyframes(later).isEmpty())
        assertEquals(GState.TOUCH_EXPLORE, m.state)
        assertEquals(listOf(Effect.ToneOff, Effect.CloseMic), m.handle(GEvent.Abort(130_000)))
        assertEquals(GState.IDLE, m.state)
    }

    @Test fun pinPadWhileTouchExploringBlocksUploadsThenReturnsToExplore() {
        exploring()
        m.handle(GEvent.ExploreSaid(1_000))
        m.handle(GEvent.TouchExploreRequested(2_000, hasLayout = true))
        val pin = m.handle(GEvent.PinGate(3_000, blocked = true, digitTokens = 10))
        assertEquals(GState.PIN_MODE, m.state)
        assertEquals(listOf(Effect.StopUploads, Effect.EnterPinMode), pin.take(2))
        m.handle(GEvent.PinGate(4_000, blocked = false, digitTokens = 0))
        val exit = m.handle(GEvent.PinGate(6_000, blocked = false, digitTokens = 0))
        assertEquals(listOf(Effect.ExitPinMode, Effect.ResumeUploads, Effect.SendKeyframe(KeyframePurpose.EXPLORE)), exit)
        assertEquals(GState.EXPLORING, m.state)
    }

    @Test fun abortClearsExploreIntent() {
        exploring()
        m.handle(GEvent.Abort(100))
        m.handle(GEvent.Start(200)); m.handle(GEvent.GoalHeard(200, "press start"))
        assertEquals(listOf(Effect.SendKeyframe(KeyframePurpose.LOCATE)), m.handle(GEvent.Frame(300, true, false, null)))
    }
}
