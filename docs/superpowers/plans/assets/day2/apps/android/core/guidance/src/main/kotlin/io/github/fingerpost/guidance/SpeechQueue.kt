package io.github.fingerpost.guidance

enum class Priority(val rank: Int) { INFO(0), GUIDE(1), STATE(2), SAFETY(3) }

data class Utterance(val text: String, val priority: Priority, val atMs: Long, val completionId: Long? = null)

sealed interface SpeechAction {
    data class Speak(val u: Utterance) : SpeechAction
    /** Stop the current utterance and speak this one now. */
    data class Interrupt(val u: Utterance) : SpeechAction
    data object Wait : SpeechAction
}

/**
 * guidance-spec §5 cadence and priorities. The TTS adapter calls [offer] for new cues, [onDone] when an
 * utterance finishes, and [poll] whenever it's idle (and on a ~50 ms tick).
 */
class SpeechQueue(private val minGuideGapMs: Long = 700, private val staleGuideMs: Long = 400) {
    private val queued = mutableListOf<Utterance>()
    var current: Utterance? = null; private set
    private var lastGuideStartMs = Long.MIN_VALUE / 2

    fun offer(u: Utterance): SpeechAction { TODO("D2-T3: implement; the tests describe the behaviour") }

    fun onDone() { TODO("D2-T3: implement; the tests describe the behaviour") }

    fun poll(nowMs: Long): SpeechAction { TODO("D2-T3: implement; the tests describe the behaviour") }

    fun clear() { TODO("D2-T3: implement; the tests describe the behaviour") }
}
