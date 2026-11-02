package io.github.fingerpost.guidance

import java.util.Locale

enum class GState { IDLE, LISTENING, FRAMING, LOCATING, GUIDING, ON_TARGET, VERIFYING, ASK, CONFIRM, AWAIT_NEXT, PIN_MODE, DONE, EXPLORING, TOUCH_EXPLORE }
enum class Evidence { SIM, SCREEN_CHANGE, DWELL }
enum class VerifyResult { OK, WRONG, NOCHANGE }
enum class KeyframePurpose { LOCATE, VERIFY, EXPLORE }
enum class HapticKind { TICK, ON_TARGET, LOST }

sealed interface GEvent {
    val nowMs: Long
    data class Start(override val nowMs: Long) : GEvent
    data class GoalHeard(override val nowMs: Long, val text: String) : GEvent
    /** One analysis frame. zone is null when there is no target yet or no valid fingertip. */
    data class Frame(override val nowMs: Long, val quadStable: Boolean, val handVisible: Boolean, val zone: Zone?) : GEvent
    /** [role] is the element's protocol role ("button", "pay", …): pay/confirm/submit pass the device safety policy first. */
    data class TargetArrived(override val nowMs: Long, val say: String, val role: String = "button") : GEvent
    data class TargetNotFound(override val nowMs: Long, val say: String) : GEvent
    data class PressDetected(override val nowMs: Long, val evidence: Evidence) : GEvent
    data class VerifyArrived(override val nowMs: Long, val result: VerifyResult, val say: String) : GEvent
    data class SpeechDone(override val nowMs: Long, val completionId: Long) : GEvent
    data class Abort(override val nowMs: Long) : GEvent
    /** The screen tracker lost the quad (guidance-spec §2: LOST). Reacquire by framing again; the goal is kept. */
    data class TrackingLost(override val nowMs: Long) : GEvent
    /** Local privacy pause ended: keep the gateway's goal and locate from a fresh, checked frame. */
    data class ResumeAfterPin(override val nowMs: Long) : GEvent
    /** Timer tick, about every 100 ms. */
    data class Tick(override val nowMs: Long) : GEvent
    /** goal.ack intent: "task" turns verified presses into AWAIT_NEXT instead of DONE. */
    data class IntentArrived(override val nowMs: Long, val intent: String) : GEvent
    data class AskArrived(override val nowMs: Long, val askId: String, val question: String, val options: List<String>) : GEvent
    /** [amountSay] is spoken after the summary when the summary doesn't already contain it. */
    data class ConfirmArrived(override val nowMs: Long, val confirmId: String, val summary: String, val amountSay: String?) : GEvent
    /** A final transcript while the app listens for an answer (ASK or CONFIRM). */
    data class UserSaid(override val nowMs: Long, val text: String) : GEvent
    /** result is the protocol's "done" | "aborted" | "failed". */
    data class FinishArrived(override val nowMs: Long, val result: String, val say: String) : GEvent
    /** The local pre-upload PIN/payment gate (guidance-spec §10.1), once per checked frame. */
    data class PinGate(override val nowMs: Long, val blocked: Boolean, val digitTokens: Int) : GEvent
    /** A server `say` (the explore summary, or the next region after "more") arrived while EXPLORING. */
    data class ExploreSaid(override val nowMs: Long) : GEvent
    /** The user said "touch explore". [hasLayout]: a layout of this screen is on the phone to explore. */
    data class TouchExploreRequested(override val nowMs: Long, val hasLayout: Boolean) : GEvent
}

sealed interface Effect {
    data class Say(val text: String, val priority: Priority, val completionId: Long? = null) : Effect
    data object OpenMic : Effect
    data object CloseMic : Effect
    data class SendKeyframe(val purpose: KeyframePurpose) : Effect
    data object ToneOn : Effect
    data object ToneOff : Effect
    data class Haptic(val kind: HapticKind) : Effect
    data class SendTapDetected(val evidence: Evidence) : Effect
    data object SendTargetReached : Effect
    data object SendScreenChanged : Effect
    data class SendAnswer(val askId: String, val text: String) : Effect
    data class SendConfirmReply(val confirmId: String, val accepted: Boolean, val utterance: String) : Effect
    data object EnterPinMode : Effect
    data object ExitPinMode : Effect
    data object StopUploads : Effect
    data object ResumeUploads : Effect
}

/** English prompts for Day 2; Day 4 moves them behind the locale tables. */
object Prompts {
    val ASK_GOAL get() = Strings.get(Key.ASK_GOAL, Strings.EN)
    val ASK_GOAL_AGAIN get() = Strings.get(Key.ASK_GOAL_AGAIN, Strings.EN)
    val GIVE_UP_LISTENING get() = Strings.get(Key.GIVE_UP_LISTENING, Strings.EN)
    val FRAMING_TIPS get() = Strings.get(Key.FRAMING_TIPS, Strings.EN)
    val LOCATE_FAILED get() = Strings.get(Key.LOCATE_FAILED, Strings.EN)
    val RAISE_FINGER get() = Strings.get(Key.RAISE_FINGER, Strings.EN)
    val TAP get() = Strings.get(Key.TAP, Strings.EN)
    val PRESS_NOW get() = Strings.get(Key.PRESS_NOW, Strings.EN)
    val OFFER_EXPLORE get() = Strings.get(Key.OFFER_EXPLORE, Strings.EN)
    val HOLD_STEADY get() = Strings.get(Key.HOLD_STEADY, Strings.EN)
}

/**
 * guidance-spec §8. Pure and deterministic: feed events, get effects. Timeouts are evaluated on Tick and
 * Frame events. Task intent adds ASK, CONFIRM and AWAIT_NEXT (Days 4–7 plan, "Contracts"); PIN_MODE is
 * entered from any active state by the local PIN gate and never asks for a keyframe.
 */
class GuidanceStateMachine(var locale: Locale = Strings.EN) {
    var chestMount: Boolean = false
    private fun prompt(key: Key): String = Strings.get(if (chestMount && key == Key.FRAMING_TIPS) Key.CHEST_FRAME else key, locale)
    var state = GState.IDLE; private set
    /** True after goal.ack says "task". Cleared when the session goes IDLE. */
    var taskIntent = false; private set
    /** True after goal.ack says "explore": keyframes ask for a summary and no target is expected. */
    var exploreIntent = false; private set
    private var summaryHeard = false
    val policy = SafetyPolicy()
    private var askId: String? = null
    private var askQuestion = ""
    private var confirmId: String? = null
    private var confirmSay = ""
    private var awaitResent = false
    private var pinQuietSince: Long? = null
    private var finishedInPin: String? = null
    private var enteredAt = 0L
    private var retried = false
    private var noHandSince: Long? = null
    private var noHandPrompted = false
    private var offeredExplore = false
    private var pressPrompted = false
    private var lastZone: Zone? = null
    private val debounce = OnTargetDebouncer()
    private var guidingSince = 0L
    private var nextCompletionId = 0L
    private var doneCompletionId: Long? = null

    private fun go(s: GState, now: Long) {
        if (s == GState.GUIDING && state != GState.ON_TARGET) guidingSince = now
        state = s
        enteredAt = now
        retried = false
        if (s == GState.ON_TARGET) pressPrompted = false
        if (s == GState.IDLE) {
            debounce.reset()
            noHandSince = null
            noHandPrompted = false
            lastZone = null
            offeredExplore = false
            verifyRetried = false
            doneCompletionId = null
            taskIntent = false
            exploreIntent = false
            policy.reset()
            askId = null; confirmId = null; finishedInPin = null
        }
        if (s == GState.AWAIT_NEXT) awaitResent = false
        if (s == GState.EXPLORING) summaryHeard = false
    }

    /** guidance-spec §10: entry stops uploads first; exit after < 5 digit tokens for 2 s. */
    private fun pinGate(ev: GEvent.PinGate): List<Effect> {
        if (state == GState.PIN_MODE) {
            if (ev.blocked || ev.digitTokens >= 5) { pinQuietSince = null; return emptyList() }
            val since = pinQuietSince ?: ev.nowMs.also { pinQuietSince = it }
            if (ev.nowMs - since < 2000) return emptyList()
            pinQuietSince = null
            val out = mutableListOf<Effect>(Effect.ExitPinMode, Effect.ResumeUploads)
            val finished = finishedInPin
            if (finished != null) {
                val id = ++nextCompletionId
                out += Effect.Say(finished, Priority.STATE, id)
                go(GState.DONE, ev.nowMs)
                doneCompletionId = id
            } else if (exploreIntent) {
                out += Effect.SendKeyframe(KeyframePurpose.EXPLORE)
                go(GState.EXPLORING, ev.nowMs)
            } else {
                out += Effect.SendKeyframe(KeyframePurpose.LOCATE)
                go(GState.LOCATING, ev.nowMs)
            }
            return out
        }
        if (!ev.blocked || state == GState.IDLE || state == GState.DONE) return emptyList()
        pinQuietSince = null
        go(GState.PIN_MODE, ev.nowMs)
        return listOf(Effect.StopUploads, Effect.EnterPinMode, Effect.ToneOff, Effect.CloseMic)
    }

    /** Server ask/confirm/finish/target handling shared by LOCATING and AWAIT_NEXT. */
    private fun serverTurn(ev: GEvent, now: Long, out: MutableList<Effect>): Boolean {
        when (ev) {
            is GEvent.TargetArrived -> {
                if (!policy.mayGuide(ev.role, "")) {
                    out += Effect.Say(prompt(Key.CONFIRM_FIRST), Priority.SAFETY)
                    if (taskIntent) go(GState.AWAIT_NEXT, now) else { out += Effect.OpenMic; go(GState.LISTENING, now) }
                    return true
                }
                debounce.reset()
                lastZone = null
                noHandSince = null
                noHandPrompted = false
                offeredExplore = false
                verifyRetried = false
                out += Effect.Say(ev.say, Priority.STATE)
                out += Effect.ToneOn
                go(GState.GUIDING, now)
            }
            is GEvent.TargetNotFound -> {
                out += Effect.Say(ev.say, Priority.STATE)
                out += Effect.OpenMic
                go(GState.LISTENING, now)
            }
            is GEvent.AskArrived -> {
                out += Effect.ToneOff
                out += Effect.Say(ev.question, Priority.STATE)
                out += Effect.OpenMic
                if (taskIntent) {
                    askId = ev.askId; askQuestion = ev.question
                    go(GState.ASK, now)
                } else go(GState.LISTENING, now)
            }
            is GEvent.ConfirmArrived -> {
                policy.onConfirm(ev.confirmId)
                confirmId = ev.confirmId
                val amount = ev.amountSay?.takeIf { it.isNotBlank() && !ev.summary.contains(it) }
                confirmSay = listOfNotNull(ev.summary.trimEnd('.', ' '), amount).joinToString(", ") + ". " + prompt(Key.SAY_YES_OR_NO)
                out += Effect.ToneOff
                out += Effect.Say(confirmSay, Priority.SAFETY)
                out += Effect.OpenMic
                go(GState.CONFIRM, now)
            }
            else -> return false
        }
        return true
    }

    fun handle(ev: GEvent): List<Effect> {
        if (ev is GEvent.PinGate) return pinGate(ev)
        if (ev is GEvent.IntentArrived) return intent(ev)
        if (state == GState.PIN_MODE) {
            // Only the gate (above), an abort, or the task's end matter while the keypad is up.
            if (ev is GEvent.FinishArrived && ev.result == "done") finishedInPin = ev.say
            if (ev is GEvent.Abort) { go(GState.IDLE, ev.nowMs); return listOf(Effect.ExitPinMode, Effect.ResumeUploads, Effect.ToneOff, Effect.CloseMic) }
            return emptyList()
        }
        if (ev is GEvent.FinishArrived) {
            if (state == GState.IDLE || state == GState.DONE) return emptyList()
            if (ev.result == "done") {
                val id = ++nextCompletionId
                go(GState.DONE, ev.nowMs)
                doneCompletionId = id
                return listOf(Effect.ToneOff, Effect.CloseMic, Effect.Say(ev.say, Priority.STATE, id))
            }
            go(GState.IDLE, ev.nowMs)
            return listOf(Effect.ToneOff, Effect.CloseMic, Effect.Say(ev.say, Priority.STATE))
        }
        if (ev is GEvent.ResumeAfterPin) {
            if (state in setOf(GState.IDLE, GState.LISTENING, GState.DONE)) return emptyList()
            debounce.reset()
            if (exploreIntent) {
                go(GState.EXPLORING, ev.nowMs)
                return listOf(Effect.ToneOff, Effect.CloseMic, Effect.SendKeyframe(KeyframePurpose.EXPLORE))
            }
            go(GState.LOCATING, ev.nowMs)
            return listOf(Effect.ToneOff, Effect.CloseMic, Effect.SendKeyframe(KeyframePurpose.LOCATE))
        }
        if (ev is GEvent.Abort) {
            if (state == GState.IDLE) return emptyList()
            go(GState.IDLE, ev.nowMs)
            return listOf(Effect.ToneOff, Effect.CloseMic)
        }
        if (ev is GEvent.TrackingLost) {
            if (state != GState.LOCATING && state != GState.GUIDING && state != GState.ON_TARGET) return emptyList()
            go(GState.FRAMING, ev.nowMs)
            return listOf(Effect.ToneOff, Effect.Haptic(HapticKind.LOST), Effect.Say(prompt(Key.HOLD_STEADY), Priority.STATE))
        }
        val out = mutableListOf<Effect>()
        val now = ev.nowMs
        val timed = ev is GEvent.Tick || ev is GEvent.Frame
        when (state) {
            GState.IDLE -> if (ev is GEvent.Start) {
                go(GState.LISTENING, now)
                out += Effect.Say(prompt(Key.ASK_GOAL), Priority.STATE)
                out += Effect.OpenMic
            }
            GState.LISTENING -> when {
                ev is GEvent.GoalHeard -> {
                    out += Effect.CloseMic
                    go(GState.FRAMING, now)
                }
                timed && now - enteredAt >= 8000 -> if (!retried) {
                    out += Effect.Say(prompt(Key.ASK_GOAL_AGAIN), Priority.STATE)
                    retried = true
                    enteredAt = now
                } else {
                    out += Effect.CloseMic
                    out += Effect.Say(prompt(Key.GIVE_UP_LISTENING), Priority.STATE)
                    go(GState.IDLE, now)
                }
            }
            GState.FRAMING -> when {
                ev is GEvent.Frame && ev.quadStable -> if (exploreIntent) {
                    out += Effect.SendKeyframe(KeyframePurpose.EXPLORE)
                    go(GState.EXPLORING, now)
                } else {
                    out += Effect.SendKeyframe(KeyframePurpose.LOCATE)
                    go(GState.LOCATING, now)
                }
                timed && now - enteredAt >= 30_000 && !retried -> {
                    out += Effect.Say(prompt(Key.FRAMING_TIPS), Priority.STATE)
                    retried = true
                }
            }
            GState.LOCATING -> when {
                serverTurn(ev, now, out) -> Unit
                timed && now - enteredAt >= 6000 -> if (!retried) {
                    out += Effect.SendKeyframe(KeyframePurpose.LOCATE)
                    retried = true
                    enteredAt = now
                } else {
                    out += Effect.Say(prompt(Key.LOCATE_FAILED), Priority.STATE)
                    go(GState.FRAMING, now)
                }
            }
            GState.GUIDING -> {
                // Task flow: the kiosk took a press before the finger reached the target (often its Back
                // button). The plan is stale, so report the change and locate again (go-back flow).
                if (ev is GEvent.PressDetected && ev.evidence == Evidence.SIM && taskIntent) {
                    out += Effect.ToneOff
                    out += Effect.SendScreenChanged
                    out += Effect.SendKeyframe(KeyframePurpose.LOCATE)
                    go(GState.LOCATING, now)
                    return out
                }
                if (ev is GEvent.Frame) guidingFrame(ev, out)
                if (timed && state == GState.GUIDING) {
                    noHandCheck(now, out)
                    if (now - guidingSince >= 45_000 && !offeredExplore) {
                        out += Effect.Say(prompt(Key.OFFER_EXPLORE), Priority.STATE)
                        offeredExplore = true
                    }
                }
            }
            GState.ON_TARGET -> when {
                ev is GEvent.PressDetected -> {
                    out += Effect.SendTapDetected(ev.evidence)
                    out += Effect.SendKeyframe(KeyframePurpose.VERIFY)
                    go(GState.VERIFYING, now)
                }
                ev is GEvent.Frame && debounce.update(if (ev.handVisible) ev.zone ?: Zone.FAR else Zone.FAR) -> {
                    out += Effect.ToneOn
                    go(GState.GUIDING, now)
                }
                timed && now - enteredAt >= 5000 && !pressPrompted -> {
                    out += Effect.Say(prompt(Key.PRESS_NOW), Priority.GUIDE)
                    pressPrompted = true
                }
            }
            GState.VERIFYING -> when {
                ev is GEvent.VerifyArrived -> verify(ev.result, ev.say, now, out)
                timed && now - enteredAt >= 4000 -> verify(VerifyResult.NOCHANGE, prompt(Key.SCREEN_NO_CHANGE), now, out)
            }
            GState.AWAIT_NEXT -> when {
                serverTurn(ev, now, out) -> Unit
                timed && now - enteredAt >= 6000 -> if (!awaitResent) {
                    out += Effect.SendKeyframe(KeyframePurpose.LOCATE)
                    awaitResent = true
                    enteredAt = now
                } else {
                    out += Effect.Say(prompt(Key.LOST_TRACK), Priority.STATE)
                    out += Effect.OpenMic
                    go(GState.LISTENING, now)
                }
            }
            GState.ASK -> when {
                ev is GEvent.UserSaid && ev.text.isNotBlank() -> {
                    out += Effect.CloseMic
                    out += Effect.SendAnswer(askId!!, ev.text)
                    out += Effect.SendKeyframe(KeyframePurpose.LOCATE)
                    askId = null
                    go(GState.LOCATING, now)
                }
                timed && now - enteredAt >= 10_000 -> if (!retried) {
                    out += Effect.Say(askQuestion, Priority.STATE)
                    out += Effect.OpenMic
                    retried = true
                    enteredAt = now
                } else {
                    out += Effect.Say(prompt(Key.ASK_AGAIN_GIVE_UP), Priority.STATE)
                    out += Effect.OpenMic
                    askId = null
                    go(GState.LISTENING, now)
                }
            }
            GState.CONFIRM -> {
                val id = confirmId!!
                when {
                    ev is GEvent.UserSaid -> when (YesNo.parse(ev.text)) {
                        true -> {
                            policy.onConfirmReply(id, true)
                            out += Effect.CloseMic
                            out += Effect.SendConfirmReply(id, true, ev.text)
                            out += Effect.SendKeyframe(KeyframePurpose.LOCATE)
                            go(GState.LOCATING, now)
                        }
                        // guidance-spec §8: anything but a clear yes cancels the step.
                        false, null -> cancelConfirm(id, ev.text, now, out)
                    }
                    timed && now - enteredAt >= 15_000 -> cancelConfirm(id, "", now, out)
                }
            }
            GState.PIN_MODE -> Unit
            GState.EXPLORING -> exploring(ev, now, out)
            GState.TOUCH_EXPLORE -> Unit  // Local only: the engine feeds TouchExplorer; nothing is uploaded.
            GState.DONE -> if (ev is GEvent.SpeechDone && ev.completionId == doneCompletionId) go(GState.IDLE, now)
        }
        return out
    }

    private var verifyRetried = false

    /**
     * goal.ack. "task" turns verified presses into AWAIT_NEXT. "explore" asks for a summary instead of a target:
     * a locate keyframe already on its way is read as explore by the gateway, so no second upload. A new goal
     * while exploring (the gateway answered it with a new intent) locates or explores again.
     */
    private fun intent(ev: GEvent.IntentArrived): List<Effect> {
        if (state == GState.IDLE || state == GState.TOUCH_EXPLORE) return emptyList()
        taskIntent = ev.intent == "task"
        exploreIntent = ev.intent == "explore"
        val now = ev.nowMs
        return when {
            state == GState.EXPLORING && exploreIntent -> { go(GState.EXPLORING, now); listOf(Effect.CloseMic, Effect.SendKeyframe(KeyframePurpose.EXPLORE)) }
            state == GState.EXPLORING -> { go(GState.LOCATING, now); listOf(Effect.CloseMic, Effect.SendKeyframe(KeyframePurpose.LOCATE)) }
            state == GState.LOCATING && exploreIntent -> { go(GState.EXPLORING, now); emptyList() }
            else -> emptyList()
        }
    }

    /** guidance-spec §8 EXPLORING: 6 s without a summary → one more explore keyframe; 12 s idle after it → hint, then end. */
    private fun exploring(ev: GEvent, now: Long, out: MutableList<Effect>) {
        val timed = ev is GEvent.Tick || ev is GEvent.Frame
        when {
            ev is GEvent.ExploreSaid -> {
                if (!summaryHeard) out += Effect.OpenMic
                summaryHeard = true; retried = false; enteredAt = now
            }
            // "more" and new goals go to the gateway through the mic stream; it answers with a say or a goal.ack.
            ev is GEvent.UserSaid || ev is GEvent.GoalHeard -> enteredAt = now
            ev is GEvent.TouchExploreRequested -> if (ev.hasLayout) {
                out += Effect.ToneOff
                out += Effect.CloseMic
                out += Effect.Say(prompt(Key.TOUCH_EXPLORE_ON), Priority.STATE)
                go(GState.TOUCH_EXPLORE, now)
            } else out += Effect.Say(prompt(Key.TOUCH_EXPLORE_NEEDS_SCREEN), Priority.STATE)
            !summaryHeard && timed && now - enteredAt >= 6000 -> if (!retried) {
                out += Effect.SendKeyframe(KeyframePurpose.EXPLORE)
                retried = true
                enteredAt = now
            } else {
                out += Effect.Say(prompt(Key.LOCATE_FAILED), Priority.STATE)
                go(GState.FRAMING, now)
            }
            summaryHeard && timed && now - enteredAt >= 12_000 -> if (!retried) {
                out += Effect.Say(prompt(Key.EXPLORE_HINT), Priority.STATE)
                out += Effect.OpenMic
                retried = true
                enteredAt = now
            } else {
                out += Effect.CloseMic
                out += Effect.Say(prompt(Key.GIVE_UP_LISTENING), Priority.STATE)
                go(GState.IDLE, now)
            }
        }
    }

    private fun cancelConfirm(id: String, utterance: String, now: Long, out: MutableList<Effect>) {
        policy.onConfirmReply(id, false)
        out += Effect.CloseMic
        out += Effect.SendConfirmReply(id, false, utterance)
        out += Effect.Say(prompt(Key.PAYMENT_NOT_CONFIRMED), Priority.SAFETY)
        go(GState.IDLE, now)
    }

    private fun verify(r: VerifyResult, say: String, now: Long, out: MutableList<Effect>) {
        val completionId = if (r == VerifyResult.OK) ++nextCompletionId else null
        out += Effect.Say(say, Priority.STATE, completionId)
        when (r) {
            VerifyResult.OK -> if (taskIntent) {
                // The agent decides what comes next; keep the session open (no completion wait).
                out[out.lastIndex] = Effect.Say(say, Priority.STATE)
                go(GState.AWAIT_NEXT, now)
            } else {
                doneCompletionId = completionId
                go(GState.DONE, now)
            }
            VerifyResult.WRONG -> {
                out += Effect.SendKeyframe(KeyframePurpose.LOCATE)
                go(GState.LOCATING, now)
            }
            VerifyResult.NOCHANGE -> if (!verifyRetried) {
                verifyRetried = true
                go(GState.ON_TARGET, now)
            } else {
                out += Effect.SendKeyframe(KeyframePurpose.LOCATE)
                go(GState.LOCATING, now)
            }
        }
    }

    private fun noHandCheck(now: Long, out: MutableList<Effect>) {
        val since = noHandSince ?: return
        if (!noHandPrompted && now - since >= 1500) {
            out += Effect.Say(prompt(Key.RAISE_FINGER), Priority.GUIDE)
            noHandPrompted = true
        }
    }

    private fun guidingFrame(ev: GEvent.Frame, out: MutableList<Effect>) {
        if (!ev.handVisible) {
            if (noHandSince == null) noHandSince = ev.nowMs
            lastZone = null
            debounce.update(Zone.FAR)
            return
        }
        noHandSince = null
        noHandPrompted = false
        val zone = ev.zone
        if (lastZone == Zone.FAR && zone == Zone.NEAR) out += Effect.Haptic(HapticKind.TICK)
        lastZone = zone
        if (debounce.update(zone ?: Zone.FAR) && debounce.onTarget) {
            out += Effect.ToneOff
            out += Effect.Haptic(HapticKind.ON_TARGET)
            out += Effect.Say(prompt(Key.TAP), Priority.STATE)
            out += Effect.SendTargetReached
            go(GState.ON_TARGET, ev.nowMs)
        }
    }
}
