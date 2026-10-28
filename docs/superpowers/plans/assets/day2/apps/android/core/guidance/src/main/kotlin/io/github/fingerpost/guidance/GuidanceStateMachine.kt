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

    private fun go(s: GState, now: Long) { TODO("D2-T4: implement; the tests describe the behaviour") }

    fun handle(ev: GEvent): List<Effect> { TODO("D2-T4: implement; the tests describe the behaviour") }

    private var verifyRetried = false

    private fun verify(r: VerifyResult, say: String, now: Long, out: MutableList<Effect>) { TODO("D2-T4: implement; the tests describe the behaviour") }

    private fun noHandCheck(now: Long, out: MutableList<Effect>) { TODO("D2-T4: implement; the tests describe the behaviour") }

    private fun guidingFrame(ev: GEvent.Frame, out: MutableList<Effect>) { TODO("D2-T4: implement; the tests describe the behaviour") }
}
