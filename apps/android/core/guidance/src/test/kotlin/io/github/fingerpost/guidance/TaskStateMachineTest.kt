package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/** Days 4–7 plan, A4-1: task turns (ASK, CONFIRM, AWAIT_NEXT) and PIN_MODE, with guidance-spec §8 timeouts. */
class TaskStateMachineTest {
    private val m = GuidanceStateMachine()

    /** Drive a task to LOCATING: start, hear the goal, learn it's a task, frame, send the locate keyframe. */
    private fun locatingTask(now: Long = 0) {
        m.handle(GEvent.Start(now))
        m.handle(GEvent.GoalHeard(now, "order a cola and pay"))
        m.handle(GEvent.IntentArrived(now, "task"))
        m.handle(GEvent.Frame(now, true, false, null))
        assertEquals(GState.LOCATING, m.state)
    }

    private fun onTarget(now: Long) {
        m.handle(GEvent.TargetArrived(now, "Found Drinks."))
        repeat(6) { m.handle(GEvent.Frame(now + it, false, true, Zone.ON)) }
        assertEquals(GState.ON_TARGET, m.state)
    }

    private fun says(effects: List<Effect>) = effects.filterIsInstance<Effect.Say>().map { it.text }

    @Test fun askRepeatsOnceAfter10sThenListens() {
        locatingTask()
        val asked = m.handle(GEvent.AskArrived(100, "ask-1", "Which one: Small, Medium or Large?", listOf("Small", "Medium", "Large")))
        assertEquals(GState.ASK, m.state)
        assertEquals(listOf("Which one: Small, Medium or Large?"), says(asked))
        assertTrue(Effect.OpenMic in asked)
        assertTrue(m.handle(GEvent.Tick(10_099)).isEmpty())
        val again = m.handle(GEvent.Tick(10_100))
        assertEquals(listOf("Which one: Small, Medium or Large?"), says(again))
        assertEquals(GState.ASK, m.state)
        val giveUp = m.handle(GEvent.Tick(20_100))
        assertEquals(GState.LISTENING, m.state)
        assertTrue(Effect.OpenMic in giveUp)
    }

    @Test fun askAnswerSendsAnswerThenLocates() {
        locatingTask()
        m.handle(GEvent.AskArrived(100, "ask-1", "Which size?", listOf("Small", "Medium")))
        val out = m.handle(GEvent.UserSaid(2_000, "medium"))
        assertEquals(listOf(Effect.CloseMic, Effect.SendAnswer("ask-1", "medium"), Effect.SendKeyframe(KeyframePurpose.LOCATE)), out)
        assertEquals(GState.LOCATING, m.state)
    }

    @Test fun askInGuideIntentListensForANewGoal() {
        m.handle(GEvent.Start(0)); m.handle(GEvent.GoalHeard(0, "press start")); m.handle(GEvent.IntentArrived(0, "guide"))
        m.handle(GEvent.Frame(0, true, false, null))
        val out = m.handle(GEvent.AskArrived(100, "ask-1", "I see Start and Quick start. Which one?", emptyList()))
        assertEquals(GState.LISTENING, m.state)
        assertFalse(out.any { it is Effect.SendAnswer })
    }

    @Test fun confirmCancelsAfter15sWithPaymentNotConfirmed() {
        locatingTask()
        val asked = m.handle(GEvent.ConfirmArrived(100, "c-1", "Medium cola, Total ₹149", null))
        assertEquals(GState.CONFIRM, m.state)
        val spoken = asked.filterIsInstance<Effect.Say>().single()
        assertEquals(Priority.SAFETY, spoken.priority)
        assertTrue(spoken.text.contains("₹149") && spoken.text.contains(TaskPrompts.SAY_YES_OR_NO))
        assertTrue(m.handle(GEvent.Tick(15_099)).isEmpty())
        val out = m.handle(GEvent.Tick(15_100))
        assertTrue(Effect.SendConfirmReply("c-1", false, "") in out)
        assertEquals(listOf(TaskPrompts.PAYMENT_NOT_CONFIRMED), says(out))
        assertEquals(GState.IDLE, m.state)
    }

    @Test fun confirmYesSendsReplyAndKeyframe() {
        locatingTask()
        m.handle(GEvent.ConfirmArrived(100, "c-1", "Medium cola, Total ₹149", null))
        val out = m.handle(GEvent.UserSaid(3_000, "Yes."))
        assertEquals(listOf(Effect.CloseMic, Effect.SendConfirmReply("c-1", true, "Yes."), Effect.SendKeyframe(KeyframePurpose.LOCATE)), out)
        assertEquals(GState.LOCATING, m.state)
        // The device policy now lets the pay target through.
        val pay = m.handle(GEvent.TargetArrived(4_000, "Found Pay by card.", role = "pay"))
        assertEquals(GState.GUIDING, m.state)
        assertEquals(listOf("Found Pay by card."), says(pay))
    }

    @Test fun confirmNoCancels() {
        locatingTask()
        m.handle(GEvent.ConfirmArrived(100, "c-1", "Total ₹149", null))
        val no = m.handle(GEvent.UserSaid(3_000, "no"))
        assertTrue(Effect.SendConfirmReply("c-1", false, "no") in no)
        assertEquals(listOf(TaskPrompts.PAYMENT_NOT_CONFIRMED), says(no))
        assertEquals(GState.IDLE, m.state)
    }

    @Test fun confirmUnclearReplyCancelsToo() {
        locatingTask()
        m.handle(GEvent.ConfirmArrived(100, "c-1", "Total ₹149", null))
        val unclear = m.handle(GEvent.UserSaid(2_000, "how much"))
        assertTrue(Effect.SendConfirmReply("c-1", false, "how much") in unclear)
        assertFalse(unclear.any { it is Effect.SendKeyframe })
        assertEquals(GState.IDLE, m.state)
    }

    @Test fun payTargetWithoutConfirmIsRefused() {
        locatingTask()
        val out = m.handle(GEvent.TargetArrived(100, "Found Pay by card.", role = "pay"))
        assertEquals(listOf(TaskPrompts.CONFIRM_FIRST), says(out))
        assertEquals(Priority.SAFETY, out.filterIsInstance<Effect.Say>().single().priority)
        assertEquals(GState.AWAIT_NEXT, m.state)
        assertFalse(Effect.ToneOn in out)
    }

    @Test fun verifyOkInTaskIntentGoesToAwaitNext() {
        locatingTask()
        onTarget(100)
        m.handle(GEvent.PressDetected(300, Evidence.SIM))
        val out = m.handle(GEvent.VerifyArrived(500, VerifyResult.OK, "Done."))
        assertEquals(GState.AWAIT_NEXT, m.state)
        assertEquals(listOf("Done."), says(out))
        // The next target arrives without a new keyframe request.
        m.handle(GEvent.TargetArrived(800, "Found Medium."))
        assertEquals(GState.GUIDING, m.state)
    }

    @Test fun verifyOkInGuideIntentStillEndsTheTask() {
        m.handle(GEvent.Start(0)); m.handle(GEvent.GoalHeard(0, "press start"))
        m.handle(GEvent.Frame(0, true, false, null))
        onTarget(100)
        m.handle(GEvent.PressDetected(300, Evidence.SIM))
        m.handle(GEvent.VerifyArrived(500, VerifyResult.OK, "Done."))
        assertEquals(GState.DONE, m.state)
    }

    @Test fun awaitNextResendsLocateAfter6sThenAsks() {
        locatingTask()
        onTarget(100)
        m.handle(GEvent.PressDetected(300, Evidence.SIM))
        m.handle(GEvent.VerifyArrived(1_000, VerifyResult.OK, "Done."))
        assertTrue(m.handle(GEvent.Tick(6_999)).isEmpty())
        assertEquals(listOf(Effect.SendKeyframe(KeyframePurpose.LOCATE)), m.handle(GEvent.Tick(7_000)))
        assertEquals(GState.AWAIT_NEXT, m.state)
        assertTrue(m.handle(GEvent.Tick(12_999)).isEmpty())
        val lost = m.handle(GEvent.Tick(13_000))
        assertEquals(listOf(TaskPrompts.LOST_TRACK), says(lost))
        assertTrue(Effect.OpenMic in lost)
        assertEquals(GState.LISTENING, m.state)
    }

    @Test fun finishDoneSpeaksThenIdles() {
        locatingTask()
        val out = m.handle(GEvent.FinishArrived(100, "done", "Your order went through."))
        assertEquals(GState.DONE, m.state)
        val say = out.filterIsInstance<Effect.Say>().single()
        m.handle(GEvent.SpeechDone(200, say.completionId!!))
        assertEquals(GState.IDLE, m.state)
    }

    @Test fun finishFailedGoesIdle() {
        locatingTask()
        val out = m.handle(GEvent.FinishArrived(100, "failed", "Please ask someone nearby for help."))
        assertEquals(listOf("Please ask someone nearby for help."), says(out))
        assertEquals(GState.IDLE, m.state)
    }

    @Test fun pinGateDuringVerifyingBlocksUpload() {
        locatingTask()
        onTarget(100)
        m.handle(GEvent.PressDetected(300, Evidence.SIM))
        assertEquals(GState.VERIFYING, m.state)
        val out = m.handle(GEvent.PinGate(400, blocked = true, digitTokens = 10))
        assertEquals(listOf(Effect.StopUploads, Effect.EnterPinMode), out.take(2))
        assertEquals(GState.PIN_MODE, m.state)
        // Nothing in PIN mode asks for a keyframe, even when a verify result or a timeout would.
        assertFalse(m.handle(GEvent.VerifyArrived(500, VerifyResult.NOCHANGE, "x")).any { it is Effect.SendKeyframe })
        assertFalse(m.handle(GEvent.Tick(60_000)).any { it is Effect.SendKeyframe })
        assertEquals(GState.PIN_MODE, m.state)
    }

    @Test fun pinExitAfterFewerThan5DigitsFor2s() {
        locatingTask()
        m.handle(GEvent.PinGate(100, blocked = true, digitTokens = 10))
        assertTrue(m.handle(GEvent.PinGate(200, blocked = false, digitTokens = 3)).isEmpty())
        assertTrue(m.handle(GEvent.PinGate(1_000, blocked = false, digitTokens = 9)).isEmpty())  // keypad back: timer restarts
        assertTrue(m.handle(GEvent.PinGate(1_100, blocked = false, digitTokens = 2)).isEmpty())
        assertTrue(m.handle(GEvent.PinGate(3_099, blocked = false, digitTokens = 2)).isEmpty())
        val out = m.handle(GEvent.PinGate(3_100, blocked = false, digitTokens = 2))
        assertEquals(listOf(Effect.ExitPinMode, Effect.ResumeUploads, Effect.SendKeyframe(KeyframePurpose.LOCATE)), out)
        assertEquals(GState.LOCATING, m.state)
    }

    @Test fun finishDuringPinModeEndsAfterExit() {
        locatingTask()
        m.handle(GEvent.PinGate(100, blocked = true, digitTokens = 10))
        assertTrue(m.handle(GEvent.FinishArrived(200, "done", "PIN entry is ready.")).isEmpty())
        m.handle(GEvent.PinGate(300, blocked = false, digitTokens = 0))
        val out = m.handle(GEvent.PinGate(2_300, blocked = false, digitTokens = 0))
        assertEquals(listOf(Effect.ExitPinMode, Effect.ResumeUploads), out.take(2))
        assertFalse(out.any { it is Effect.SendKeyframe })
        assertEquals(GState.DONE, m.state)
    }

    @Test fun yesNoInEnglishHindiSpanish() {
        for (t in listOf("yes", "Yes.", "yeah please", "haan", "हाँ", "sí", "Si")) assertEquals(true, YesNo.parse(t, "en"), t)
        for (t in listOf("no", "No thanks", "nahin", "नहीं", "nope")) assertEquals(false, YesNo.parse(t, "en"), t)
        for (t in listOf("", "  ", "yesterday", "maybe", "how much")) assertEquals(null, YesNo.parse(t, "en"), t)
    }
}
