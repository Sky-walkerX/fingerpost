package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class GuidanceStateMachineTest {
    @Test fun pinExitRequestsFreshLocateWithoutLosingTheActiveGoal() {
        val s = GuidanceStateMachine().toGuiding()
        assertEquals(listOf(Effect.ToneOff, Effect.CloseMic, Effect.SendKeyframe(KeyframePurpose.LOCATE)),
            s.handle(GEvent.ResumeAfterPin(30)))
        assertEquals(GState.LOCATING, s.state)
    }
    private fun sm() = GuidanceStateMachine()
    private fun GuidanceStateMachine.toGuiding(): GuidanceStateMachine {
        handle(GEvent.Start(0)); handle(GEvent.GoalHeard(1000, "start"))
        handle(GEvent.Frame(1100, quadStable = true, handVisible = false, zone = null))
        handle(GEvent.TargetArrived(2000, "Found Start, bottom right."))
        return this
    }
    private fun GuidanceStateMachine.frames(from: Long, n: Int, zone: Zone, hand: Boolean = true): List<Effect> =
        (0 until n).flatMap { handle(GEvent.Frame(from + it * 33L, quadStable = true, handVisible = hand, zone = zone)) }

    @Test fun startAsksAndOpensTheMic() {
        val s = sm()
        assertEquals(listOf(Effect.Say(Prompts.ASK_GOAL, Priority.STATE), Effect.OpenMic), s.handle(GEvent.Start(0)))
        assertEquals(GState.LISTENING, s.state)
    }

    @Test fun happyPathToDone() {
        val s = sm().toGuiding()
        assertEquals(GState.GUIDING, s.state)
        val onEffects = s.frames(3000, 6, Zone.ON)
        assertEquals(GState.ON_TARGET, s.state)
        assertEquals(listOf(Effect.ToneOff, Effect.Haptic(HapticKind.ON_TARGET), Effect.Say(Prompts.TAP, Priority.STATE), Effect.SendTargetReached), onEffects)
        assertEquals(listOf(Effect.SendTapDetected(Evidence.SCREEN_CHANGE), Effect.SendKeyframe(KeyframePurpose.VERIFY)), s.handle(GEvent.PressDetected(3500, Evidence.SCREEN_CHANGE)))
        assertEquals(GState.VERIFYING, s.state)
        val done = s.handle(GEvent.VerifyArrived(4000, VerifyResult.OK, "Done.")).single() as Effect.Say
        assertEquals(GState.DONE, s.state)
        s.handle(GEvent.Tick(5600)); assertEquals(GState.DONE, s.state)
        s.handle(GEvent.SpeechDone(5700, requireNotNull(done.completionId)))
        assertEquals(GState.IDLE, s.state)
    }

    @Test fun quadStableSendsALocateKeyframe() {
        val s = sm(); s.handle(GEvent.Start(0)); s.handle(GEvent.GoalHeard(10, "start"))
        assertEquals(listOf(Effect.SendKeyframe(KeyframePurpose.LOCATE)), s.handle(GEvent.Frame(20, true, false, null)))
        assertEquals(GState.LOCATING, s.state)
    }

    @Test fun listeningRepromptsAt8sThenGivesUpAt16s() {
        val s = sm(); s.handle(GEvent.Start(0))
        assertEquals(listOf(Effect.Say(Prompts.ASK_GOAL_AGAIN, Priority.STATE)), s.handle(GEvent.Tick(8000)))
        assertEquals(GState.LISTENING, s.state)
        assertEquals(listOf(Effect.CloseMic, Effect.Say(Prompts.GIVE_UP_LISTENING, Priority.STATE)), s.handle(GEvent.Tick(16_000)))
        assertEquals(GState.IDLE, s.state)
    }

    @Test fun locatingRetriesOnceThenReturnsToFraming() {
        val s = sm(); s.handle(GEvent.Start(0)); s.handle(GEvent.GoalHeard(0, "x")); s.handle(GEvent.Frame(0, true, false, null))
        assertEquals(listOf(Effect.SendKeyframe(KeyframePurpose.LOCATE)), s.handle(GEvent.Tick(6000)))
        assertEquals(listOf(Effect.Say(Prompts.LOCATE_FAILED, Priority.STATE)), s.handle(GEvent.Tick(12_000)))
        assertEquals(GState.FRAMING, s.state)
    }

    @Test fun targetNotFoundGoesBackToListening() {
        val s = sm(); s.handle(GEvent.Start(0)); s.handle(GEvent.GoalHeard(0, "x")); s.handle(GEvent.Frame(0, true, false, null))
        assertEquals(listOf(Effect.Say("I see Timer and Menu.", Priority.STATE), Effect.OpenMic), s.handle(GEvent.TargetNotFound(100, "I see Timer and Menu.")))
        assertEquals(GState.LISTENING, s.state)
    }

    @Test fun noHandFor1500msPromptsOnce() {
        val s = sm().toGuiding()
        val effects = s.frames(3000, 60, Zone.FAR, hand = false) // 2 s without a hand
        assertEquals(1, effects.count { it == Effect.Say(Prompts.RAISE_FINGER, Priority.GUIDE) })
    }

    @Test fun enteringNearFromFarTicks() {
        val s = sm().toGuiding()
        s.frames(3000, 2, Zone.FAR)
        assertTrue(Effect.Haptic(HapticKind.TICK) in s.frames(3100, 1, Zone.NEAR))
    }

    @Test fun leavingTheTargetReturnsToGuidingAndRestartsTheTone() {
        val s = sm().toGuiding(); s.frames(3000, 6, Zone.ON)
        val e = s.frames(3300, 3, Zone.EDGE)
        assertEquals(GState.GUIDING, s.state); assertTrue(Effect.ToneOn in e)
    }

    @Test fun pressNowPromptAfter5sOnTarget() {
        val s = sm().toGuiding(); s.frames(3000, 6, Zone.ON)
        assertEquals(listOf(Effect.Say(Prompts.PRESS_NOW, Priority.GUIDE)), s.handle(GEvent.Tick(8200)))
        assertEquals(emptyList<Effect>(), s.handle(GEvent.Tick(9000)))
    }

    @Test fun nochangeRetriesOnTargetOnceThenRelocates() {
        val s = sm().toGuiding(); s.frames(3000, 6, Zone.ON)
        s.handle(GEvent.PressDetected(3500, Evidence.DWELL))
        s.handle(GEvent.VerifyArrived(4000, VerifyResult.NOCHANGE, "Press a little firmer."))
        assertEquals(GState.ON_TARGET, s.state)
        s.handle(GEvent.PressDetected(4500, Evidence.DWELL))
        val e = s.handle(GEvent.VerifyArrived(5000, VerifyResult.NOCHANGE, "Still no change."))
        assertEquals(GState.LOCATING, s.state); assertTrue(Effect.SendKeyframe(KeyframePurpose.LOCATE) in e)
    }

    @Test fun verifyTimeoutAt4sCountsAsNoChange() {
        val s = sm().toGuiding(); s.frames(3000, 6, Zone.ON)
        s.handle(GEvent.PressDetected(3500, Evidence.SCREEN_CHANGE))
        s.handle(GEvent.Tick(7500))
        assertEquals(GState.ON_TARGET, s.state)
    }

    @Test fun wrongPressRelocates() {
        val s = sm().toGuiding(); s.frames(3000, 6, Zone.ON)
        s.handle(GEvent.PressDetected(3500, Evidence.SIM))
        assertTrue(Effect.SendKeyframe(KeyframePurpose.LOCATE) in s.handle(GEvent.VerifyArrived(4000, VerifyResult.WRONG, "That was Menu.")))
        assertEquals(GState.LOCATING, s.state)
    }

    @Test fun offerExploreAfter45sGuiding() {
        val s = sm().toGuiding()
        assertEquals(listOf(Effect.Say(Prompts.OFFER_EXPLORE, Priority.STATE)), s.handle(GEvent.Tick(47_000)))
    }

    @Test fun abortFromAnyStateGoesIdleAndSilencesEverything() {
        val s = sm().toGuiding()
        assertEquals(listOf(Effect.ToneOff, Effect.CloseMic), s.handle(GEvent.Abort(3000)))
        assertEquals(GState.IDLE, s.state)
        assertEquals(emptyList<Effect>(), s.handle(GEvent.Abort(3100)))
    }
}
