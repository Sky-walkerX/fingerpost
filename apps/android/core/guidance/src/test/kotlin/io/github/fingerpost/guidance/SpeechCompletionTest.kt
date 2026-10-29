package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class SpeechCompletionTest {
    @Test fun callbackQueuedBeforeAnInterruptionCannotClearTheReplacement() {
        val queue = SpeechQueue()
        val old = Utterance("Synthetic state", Priority.STATE, 0, 1)
        queue.offer(old); queue.poll(0)
        val replacement = Utterance("Synthetic safety", Priority.SAFETY, 1)
        assertTrue(queue.offer(replacement) is SpeechAction.Interrupt)
        assertFalse(queue.onDone(old))
        assertSame(replacement, queue.current)
        assertTrue(queue.onDone(replacement))
        assertNull(queue.current)
    }
}
