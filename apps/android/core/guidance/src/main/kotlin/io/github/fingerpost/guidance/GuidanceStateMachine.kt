package io.github.fingerpost.guidance

enum class GState { IDLE, LISTENING, FRAMING, LOCATING, GUIDING, ON_TARGET, VERIFYING, DONE }
enum class Evidence { SIM, SCREEN_CHANGE, DWELL }
enum class VerifyResult { OK, WRONG, NOCHANGE }
enum class KeyframePurpose { LOCATE, VERIFY }
enum class HapticKind { TICK, ON_TARGET, LOST }

sealed interface GEvent {
    val nowMs: Long
    data class Start(override val nowMs: Long) : GEvent
    data class GoalHeard(override val nowMs: Long, val text: String) : GEvent
    /** One analysis frame. zone is null when there is no target yet or no valid fingertip. */
    data class Frame(override val nowMs: Long, val quadStable: Boolean, val handVisible: Boolean, val zone: Zone?) : GEvent
    data class TargetArrived(override val nowMs: Long, val say: String) : GEvent
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
}

/** English prompts for Day 2; Day 4 moves them behind the locale tables. */
object Prompts {
    const val ASK_GOAL = "What do you want to press?"
    const val ASK_GOAL_AGAIN = "Say what you want to press, for example: start."
    const val GIVE_UP_LISTENING = "Tap the screen when you're ready."
    const val FRAMING_TIPS = "Hold the phone about an arm's length from the screen, and point it straight at it."
    const val LOCATE_FAILED = "I couldn't read the screen. Let's try again."
    const val RAISE_FINGER = "Raise your pointing finger into view."
    const val TAP = "Tap."
    const val PRESS_NOW = "Press now."
    const val OFFER_EXPLORE = "Having trouble? Say explore to hear what's on the screen."
    const val HOLD_STEADY = "Hold the phone steady."
}

/**
 * guidance-spec §8 (the Day 2 subset: no ASK/CONFIRM/PIN_MODE yet). Pure and deterministic:
 * feed events, get effects. Timeouts are evaluated on Tick and Frame events.
 */
class GuidanceStateMachine {
    var state = GState.IDLE; private set
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
        }
    }

    fun handle(ev: GEvent): List<Effect> {
        if (ev is GEvent.ResumeAfterPin) {
            if (state in setOf(GState.IDLE, GState.LISTENING, GState.DONE)) return emptyList()
            debounce.reset()
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
            return listOf(Effect.ToneOff, Effect.Haptic(HapticKind.LOST), Effect.Say(Prompts.HOLD_STEADY, Priority.STATE))
        }
        val out = mutableListOf<Effect>()
        val now = ev.nowMs
        val timed = ev is GEvent.Tick || ev is GEvent.Frame
        when (state) {
            GState.IDLE -> if (ev is GEvent.Start) {
                go(GState.LISTENING, now)
                out += Effect.Say(Prompts.ASK_GOAL, Priority.STATE)
                out += Effect.OpenMic
            }
            GState.LISTENING -> when {
                ev is GEvent.GoalHeard -> {
                    out += Effect.CloseMic
                    go(GState.FRAMING, now)
                }
                timed && now - enteredAt >= 8000 -> if (!retried) {
                    out += Effect.Say(Prompts.ASK_GOAL_AGAIN, Priority.STATE)
                    retried = true
                    enteredAt = now
                } else {
                    out += Effect.CloseMic
                    out += Effect.Say(Prompts.GIVE_UP_LISTENING, Priority.STATE)
                    go(GState.IDLE, now)
                }
            }
            GState.FRAMING -> when {
                ev is GEvent.Frame && ev.quadStable -> {
                    out += Effect.SendKeyframe(KeyframePurpose.LOCATE)
                    go(GState.LOCATING, now)
                }
                timed && now - enteredAt >= 30_000 && !retried -> {
                    out += Effect.Say(Prompts.FRAMING_TIPS, Priority.STATE)
                    retried = true
                }
            }
            GState.LOCATING -> when {
                ev is GEvent.TargetArrived -> {
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
                ev is GEvent.TargetNotFound -> {
                    out += Effect.Say(ev.say, Priority.STATE)
                    out += Effect.OpenMic
                    go(GState.LISTENING, now)
                }
                timed && now - enteredAt >= 6000 -> if (!retried) {
                    out += Effect.SendKeyframe(KeyframePurpose.LOCATE)
                    retried = true
                    enteredAt = now
                } else {
                    out += Effect.Say(Prompts.LOCATE_FAILED, Priority.STATE)
                    go(GState.FRAMING, now)
                }
            }
            GState.GUIDING -> {
                if (ev is GEvent.Frame) guidingFrame(ev, out)
                if (timed && state == GState.GUIDING) {
                    noHandCheck(now, out)
                    if (now - guidingSince >= 45_000 && !offeredExplore) {
                        out += Effect.Say(Prompts.OFFER_EXPLORE, Priority.STATE)
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
                    out += Effect.Say(Prompts.PRESS_NOW, Priority.GUIDE)
                    pressPrompted = true
                }
            }
            GState.VERIFYING -> when {
                ev is GEvent.VerifyArrived -> verify(ev.result, ev.say, now, out)
                timed && now - enteredAt >= 4000 -> verify(VerifyResult.NOCHANGE, "The screen didn't change. Press a little firmer.", now, out)
            }
            GState.DONE -> if (ev is GEvent.SpeechDone && ev.completionId == doneCompletionId) go(GState.IDLE, now)
        }
        return out
    }

    private var verifyRetried = false

    private fun verify(r: VerifyResult, say: String, now: Long, out: MutableList<Effect>) {
        val completionId = if (r == VerifyResult.OK) ++nextCompletionId else null
        out += Effect.Say(say, Priority.STATE, completionId)
        when (r) {
            VerifyResult.OK -> {
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
            out += Effect.Say(Prompts.RAISE_FINGER, Priority.GUIDE)
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
            out += Effect.Say(Prompts.TAP, Priority.STATE)
            out += Effect.SendTargetReached
            go(GState.ON_TARGET, ev.nowMs)
        }
    }
}
