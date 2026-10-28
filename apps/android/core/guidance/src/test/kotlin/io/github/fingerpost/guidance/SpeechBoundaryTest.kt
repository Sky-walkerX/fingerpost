package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class SpeechBoundaryTest {
    @Test fun untranslatedLocalesAreRejectedExplicitly() {
        assertThrows(IllegalArgumentException::class.java) {
            Phrases.render(GuideCue(listOf(Dir.RIGHT), MagnitudeWord.NONE), "hi")
        }
    }

    @Test fun directionsWithNoMagnitudeStillRenderAndAnEmptyCueIsSilent() {
        assertEquals("Back.", Phrases.render(GuideCue(listOf(Dir.BACK), null)))
        assertNull(Phrases.render(GuideCue(emptyList(), MagnitudeWord.A_LOT)))
    }

    @Test fun aGuideCueAtExactlyTheStaleBoundaryCanStillSpeak() {
        val q = SpeechQueue()
        val guide = Utterance("Right.", Priority.GUIDE, 0)
        q.offer(guide)
        assertEquals(SpeechAction.Speak(guide), q.poll(400))
    }

    @Test fun guideInterruptionsAlsoRespectTheMinimumCadence() {
        val q = SpeechQueue()
        q.offer(Utterance("Right.", Priority.GUIDE, 0)); q.poll(0); q.onDone()
        q.offer(Utterance("Control name.", Priority.INFO, 10)); q.poll(10)
        assertEquals(SpeechAction.Wait, q.offer(Utterance("Up.", Priority.GUIDE, 100)))
        q.onDone()
        assertEquals(SpeechAction.Wait, q.poll(400))
        val fresh = Utterance("Up a little.", Priority.GUIDE, 650)
        q.offer(fresh)
        assertEquals(SpeechAction.Speak(fresh), q.poll(700))
    }

    @Test fun guideInterruptionRecordsItsStartForTheNextCue() {
        val q = SpeechQueue()
        q.offer(Utterance("Right.", Priority.GUIDE, 0)); q.poll(0); q.onDone()
        q.offer(Utterance("Control name.", Priority.INFO, 10)); q.poll(10)
        val guide = Utterance("Up.", Priority.GUIDE, 700)
        assertEquals(SpeechAction.Interrupt(guide), q.offer(guide))
        q.onDone()
        q.offer(Utterance("Left.", Priority.GUIDE, 710))
        assertEquals(SpeechAction.Wait, q.poll(710))
    }

    @Test fun clearCancelsCurrentAndPendingSpeechAndStartsANewCadence() {
        val q = SpeechQueue()
        q.offer(Utterance("Safety.", Priority.SAFETY, 0)); q.poll(0)
        q.offer(Utterance("Old state.", Priority.STATE, 10))
        q.clear()
        assertNull(q.current)
        assertEquals(SpeechAction.Wait, q.poll(20))
        q.offer(Utterance("Right.", Priority.GUIDE, 30)); q.poll(30)
        q.clear()
        val fresh = Utterance("Left.", Priority.GUIDE, 40)
        q.offer(fresh)
        assertEquals(SpeechAction.Speak(fresh), q.poll(40))
    }
}
