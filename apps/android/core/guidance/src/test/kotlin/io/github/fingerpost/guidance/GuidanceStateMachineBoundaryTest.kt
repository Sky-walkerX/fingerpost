package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class GuidanceStateMachineBoundaryTest {
    private fun GuidanceStateMachine.guiding(start: Long = 0): GuidanceStateMachine {
        handle(GEvent.Start(start))
        handle(GEvent.GoalHeard(start + 1, "start"))
        handle(GEvent.Frame(start + 2, true, false, null))
        handle(GEvent.TargetArrived(start + 3, "Found Start."))
        return this
    }
    private fun GuidanceStateMachine.onTarget(start: Long = 10) {
        repeat(6) { handle(GEvent.Frame(start + it, true, true, Zone.ON)) }
    }
    private fun GuidanceStateMachine.done(start: Long = 20): Effect.Say {
        onTarget(start)
        handle(GEvent.PressDetected(start + 6, Evidence.SIM))
        return handle(GEvent.VerifyArrived(start + 7, VerifyResult.OK, "Done.")).single() as Effect.Say
    }

    @Test fun terminalSpeechNeedsItsOwnCompletionEvenAfterLongWaits() {
        val s = GuidanceStateMachine().guiding()
        val say = s.done()
        assertEquals("Done.", say.text)
        assertEquals(Priority.STATE, say.priority)
        assertNotNull(say.completionId)
        assertTrue(s.handle(GEvent.Tick(100_000)).isEmpty())
        assertTrue(s.handle(GEvent.SpeechDone(100_001, requireNotNull(say.completionId) + 1)).isEmpty())
        assertEquals(GState.DONE, s.state)
        assertTrue(s.handle(GEvent.SpeechDone(100_002, say.completionId)).isEmpty())
        assertEquals(GState.IDLE, s.state)
    }

    @Test fun abortedTasksCannotCompleteNewTasksWithStaleCallbacks() {
        val s = GuidanceStateMachine().guiding()
        val oldId = requireNotNull(s.done().completionId)
        s.handle(GEvent.Abort(30))
        s.guiding(100)
        val newId = requireNotNull(s.done(120).completionId)
        assertNotEquals(oldId, newId)
        s.handle(GEvent.SpeechDone(150, oldId))
        assertEquals(GState.DONE, s.state)
        s.handle(GEvent.SpeechDone(151, newId))
        assertEquals(GState.IDLE, s.state)
    }

    @Test fun queueRetainsTerminalCompletionIdBehindExistingStateSpeech() {
        val queue = SpeechQueue()
        queue.offer(Utterance("Found Start.", Priority.STATE, 0))
        queue.poll(0)
        val terminal = Utterance("Done.", Priority.STATE, 1, completionId = 42)
        assertEquals(SpeechAction.Wait, queue.offer(terminal))
        queue.onDone()
        assertEquals(SpeechAction.Speak(terminal), queue.poll(2))
        assertEquals(42L, queue.current?.completionId)
    }

    @Test fun timeoutsRunOnFramesAndNotBeforeTheirBoundary() {
        val s = GuidanceStateMachine()
        s.handle(GEvent.Start(0))
        assertTrue(s.handle(GEvent.Tick(7999)).isEmpty())
        assertEquals(listOf(Effect.Say(Prompts.ASK_GOAL_AGAIN, Priority.STATE)), s.handle(GEvent.Frame(8000, false, false, null)))
        s.handle(GEvent.Frame(16_000, false, false, null))
        assertEquals(GState.IDLE, s.state)
    }

    @Test fun framingTipsAreOncePerFramingEntryAndUnstableFramesNeverUpload() {
        val s = GuidanceStateMachine()
        s.handle(GEvent.Start(0)); s.handle(GEvent.GoalHeard(0, "start"))
        assertTrue(s.handle(GEvent.Frame(29_999, false, false, null)).isEmpty())
        assertEquals(listOf(Effect.Say(Prompts.FRAMING_TIPS, Priority.STATE)), s.handle(GEvent.Frame(30_000, false, false, null)))
        assertTrue(s.handle(GEvent.Tick(60_000)).isEmpty())
        assertEquals(GState.FRAMING, s.state)
    }

    @Test fun aVisibleHandResetsTheNoHandStretchAndItCanPromptAgain() {
        val s = GuidanceStateMachine().guiding()
        s.handle(GEvent.Frame(10, true, false, null))
        assertTrue(s.handle(GEvent.Tick(1509)).isEmpty())
        assertEquals(listOf(Effect.Say(Prompts.RAISE_FINGER, Priority.GUIDE)), s.handle(GEvent.Tick(1510)))
        assertTrue(s.handle(GEvent.Tick(2000)).isEmpty())
        s.handle(GEvent.Frame(2001, true, true, Zone.FAR))
        s.handle(GEvent.Frame(2002, true, false, null))
        assertEquals(listOf(Effect.Say(Prompts.RAISE_FINGER, Priority.GUIDE)), s.handle(GEvent.Tick(3502)))
    }

    @Test fun missingHandAndUnknownZoneBreakConsecutiveOnFrames() {
        val s = GuidanceStateMachine().guiding()
        repeat(5) { s.handle(GEvent.Frame(10L + it, true, true, Zone.ON)) }
        s.handle(GEvent.Frame(15, true, false, null))
        repeat(5) { s.handle(GEvent.Frame(20L + it, true, true, Zone.ON)) }
        assertEquals(GState.GUIDING, s.state)
        s.handle(GEvent.Frame(25, true, true, null))
        repeat(5) { s.handle(GEvent.Frame(30L + it, true, true, Zone.ON)) }
        assertEquals(GState.GUIDING, s.state)
        s.handle(GEvent.Frame(35, true, true, Zone.ON))
        assertEquals(GState.ON_TARGET, s.state)
    }

    @Test fun losingTheHandOnTargetLeavesAfterThreeFrames() {
        val s = GuidanceStateMachine().guiding(); s.onTarget()
        repeat(2) { assertTrue(s.handle(GEvent.Frame(20L + it, true, false, null)).isEmpty()) }
        assertEquals(listOf(Effect.ToneOn), s.handle(GEvent.Frame(22, true, false, null)))
        assertEquals(GState.GUIDING, s.state)
    }

    @Test fun leavingOnTargetKeepsTheOriginalExploreDeadlineAndDoesNotRepeatIt() {
        val s = GuidanceStateMachine().guiding(); s.onTarget(40_000)
        repeat(3) { s.handle(GEvent.Frame(40_010L + it, true, true, Zone.EDGE)) }
        assertEquals(listOf(Effect.Say(Prompts.OFFER_EXPLORE, Priority.STATE)), s.handle(GEvent.Tick(45_003)))
        assertTrue(s.handle(GEvent.Tick(50_000)).isEmpty())
    }

    @Test fun newTasksResetListeningAndLocatingRetryBudgets() {
        val s = GuidanceStateMachine()
        s.handle(GEvent.Start(0)); s.handle(GEvent.Tick(8000)); s.handle(GEvent.Abort(8001))
        s.handle(GEvent.Start(9000))
        assertEquals(listOf(Effect.Say(Prompts.ASK_GOAL_AGAIN, Priority.STATE)), s.handle(GEvent.Tick(17_000)))
        s.handle(GEvent.GoalHeard(17_001, "start")); s.handle(GEvent.Frame(17_002, true, false, null))
        s.handle(GEvent.Tick(23_002)); s.handle(GEvent.Tick(29_002))
        assertEquals(GState.FRAMING, s.state)
        s.handle(GEvent.Frame(29_003, true, false, null))
        assertEquals(listOf(Effect.SendKeyframe(KeyframePurpose.LOCATE)), s.handle(GEvent.Tick(35_003)))
    }

    @Test fun noChangeBudgetResetsWhenANewTargetArrives() {
        val s = GuidanceStateMachine().guiding(); s.onTarget()
        s.handle(GEvent.PressDetected(20, Evidence.SIM)); s.handle(GEvent.VerifyArrived(21, VerifyResult.NOCHANGE, "Try again."))
        s.handle(GEvent.PressDetected(22, Evidence.SIM)); s.handle(GEvent.VerifyArrived(23, VerifyResult.WRONG, "Wrong."))
        s.handle(GEvent.TargetArrived(24, "Found Start.")); s.onTarget(30)
        s.handle(GEvent.PressDetected(40, Evidence.SIM)); s.handle(GEvent.VerifyArrived(41, VerifyResult.NOCHANGE, "Try again."))
        assertEquals(GState.ON_TARGET, s.state)
    }

    @Test fun unexpectedEventsAreIgnoredAndAbortIsSafeInEveryReachableState() {
        val s = GuidanceStateMachine()
        assertTrue(s.handle(GEvent.TargetArrived(0, "Unexpected.")).isEmpty())
        assertTrue(s.handle(GEvent.SpeechDone(1, 1)).isEmpty())
        s.guiding(); s.onTarget(); s.handle(GEvent.PressDetected(20, Evidence.SIM))
        assertEquals(listOf(Effect.ToneOff, Effect.CloseMic), s.handle(GEvent.Abort(21)))
        assertEquals(GState.IDLE, s.state)
        assertTrue(s.handle(GEvent.VerifyArrived(22, VerifyResult.OK, "Stale.")).isEmpty())
    }

    @Test fun lostTrackingReturnsToFramingKeepingTheGoal() {
        val s = GuidanceStateMachine().guiding()
        s.onTarget()
        assertEquals(GState.ON_TARGET, s.state)
        val out = s.handle(GEvent.TrackingLost(30))
        assertEquals(GState.FRAMING, s.state)
        assertEquals(listOf(Effect.ToneOff, Effect.Haptic(HapticKind.LOST), Effect.Say(Prompts.HOLD_STEADY, Priority.STATE)), out)
        assertEquals(listOf(Effect.SendKeyframe(KeyframePurpose.LOCATE)), s.handle(GEvent.Frame(31, true, true, null)))
        assertEquals(GState.LOCATING, s.state)
    }
    @Test fun lostTrackingIsIgnoredWhileListeningOrFraming() {
        val s = GuidanceStateMachine()
        s.handle(GEvent.Start(0))
        assertTrue(s.handle(GEvent.TrackingLost(1)).isEmpty())
        s.handle(GEvent.GoalHeard(2, "start"))
        assertTrue(s.handle(GEvent.TrackingLost(3)).isEmpty())
        assertEquals(GState.FRAMING, s.state)
    }
}
