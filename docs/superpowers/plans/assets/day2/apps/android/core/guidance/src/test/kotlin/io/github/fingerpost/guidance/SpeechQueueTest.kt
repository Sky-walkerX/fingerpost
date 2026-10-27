package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class SpeechQueueTest {
    private fun u(text: String, p: Priority, at: Long) = Utterance(text, p, at)

    @Test fun idleQueueSpeaksImmediately() {
        val q = SpeechQueue()
        assertEquals(SpeechAction.Wait, q.offer(u("Right.", Priority.GUIDE, 0)))
        assertEquals(SpeechAction.Speak(u("Right.", Priority.GUIDE, 0)), q.poll(0))
    }

    @Test fun guideCuesAreAtLeast700msApart() {
        val q = SpeechQueue()
        q.offer(u("Right.", Priority.GUIDE, 0)); q.poll(0); q.onDone()
        q.offer(u("Up.", Priority.GUIDE, 300))
        assertEquals(SpeechAction.Wait, q.poll(400))
        q.offer(u("Up a little.", Priority.GUIDE, 650))
        assertEquals(SpeechAction.Speak(u("Up a little.", Priority.GUIDE, 650)), q.poll(700))
    }

    @Test fun guideCuesOlderThan400msAreDropped() {
        val q = SpeechQueue()
        q.offer(u("Right.", Priority.GUIDE, 0))
        assertEquals(SpeechAction.Wait, q.poll(401))
    }

    @Test fun newerCueReplacesAQueuedOneOfTheSamePriority() {
        val q = SpeechQueue()
        q.offer(u("Busy", Priority.STATE, 0)); q.poll(0)  // speaking a STATE line
        q.offer(u("Right.", Priority.GUIDE, 10)); q.offer(u("Left.", Priority.GUIDE, 20))
        q.onDone()
        assertEquals(SpeechAction.Speak(u("Left.", Priority.GUIDE, 20)), q.poll(30))
    }

    @Test fun higherPriorityInterruptsLower() {
        val q = SpeechQueue()
        q.offer(u("Right.", Priority.GUIDE, 0)); q.poll(0)
        assertEquals(SpeechAction.Interrupt(u("Tap.", Priority.STATE, 50)), q.offer(u("Tap.", Priority.STATE, 50)))
    }

    @Test fun safetyIsNeverInterrupted() {
        val q = SpeechQueue()
        q.offer(u("Connect earphones for PIN help.", Priority.SAFETY, 0)); q.poll(0)
        assertEquals(SpeechAction.Wait, q.offer(u("Done.", Priority.STATE, 10)))
        q.onDone()
        assertEquals(SpeechAction.Speak(u("Done.", Priority.STATE, 10)), q.poll(20))
    }

    @Test fun equalPriorityWaits() {
        val q = SpeechQueue()
        q.offer(u("Found Start.", Priority.STATE, 0)); q.poll(0)
        assertEquals(SpeechAction.Wait, q.offer(u("Done.", Priority.STATE, 10)))
    }

    @Test fun higherPriorityQueuedFirst() {
        val q = SpeechQueue()
        q.offer(u("info", Priority.INFO, 0)); q.offer(u("state", Priority.STATE, 1))
        assertEquals(SpeechAction.Speak(u("state", Priority.STATE, 1)), q.poll(2))
    }
}
