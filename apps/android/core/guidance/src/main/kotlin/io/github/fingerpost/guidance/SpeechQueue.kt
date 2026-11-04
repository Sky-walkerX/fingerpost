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

    fun offer(u: Utterance): SpeechAction {
        // Server status messages each carry news (new screen, then its target): keep them in order.
        if (u.priority != Priority.STATE) queued.removeAll { it.priority == u.priority }
        val playing = current
        val cadenceAllows = u.priority != Priority.GUIDE || u.atMs - lastGuideStartMs >= minGuideGapMs
        if (playing != null && playing.priority != Priority.SAFETY &&
            u.priority.rank > playing.priority.rank && cadenceAllows) {
            current = u
            if (u.priority == Priority.GUIDE) lastGuideStartMs = u.atMs
            return SpeechAction.Interrupt(u)
        }
        queued.add(u)
        return SpeechAction.Wait
    }

    fun onDone() { current = null }

    /** Android callbacks can already be queued when a higher-priority utterance replaces this one. */
    fun onDone(expected: Utterance): Boolean {
        if (current !== expected) return false
        current = null
        return true
    }

    fun poll(nowMs: Long): SpeechAction {
        if (current != null) return SpeechAction.Wait
        queued.removeAll { it.priority == Priority.GUIDE && nowMs - it.atMs > staleGuideMs }
        val next = queued.sortedWith(compareByDescending<Utterance> { it.priority.rank }.thenBy { it.atMs })
            .firstOrNull() ?: return SpeechAction.Wait
        if (next.priority == Priority.GUIDE && nowMs - lastGuideStartMs < minGuideGapMs) return SpeechAction.Wait
        queued.remove(next)
        current = next
        if (next.priority == Priority.GUIDE) lastGuideStartMs = nowMs
        return SpeechAction.Speak(next)
    }

    fun clear() {
        queued.clear()
        current = null
        lastGuideStartMs = Long.MIN_VALUE / 2
    }
}
