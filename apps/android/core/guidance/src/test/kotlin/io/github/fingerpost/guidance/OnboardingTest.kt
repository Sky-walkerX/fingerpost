package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class OnboardingTest {
    @Test fun `first launch explains the touchscreen purpose`() {
        val guide = OnboardingGuide()
        assertFalse(guide.complete)
        assertEquals("Fingerpost helps you press buttons on touchscreens.", guide.prompt?.text)
    }

    @Test fun `successful speech walks all four instructions then completes`() {
        val guide = OnboardingGuide()
        val lines = mutableListOf<String>()
        repeat(4) {
            val prompt = requireNotNull(guide.prompt)
            lines += prompt.text
            guide.speechDone(prompt.id)
        }
        assertTrue(guide.complete)
        assertNull(guide.prompt)
        assertTrue(lines[1].contains("chest mount"))
        assertTrue(lines[2].contains("Directions follow the screen"))
        assertEquals("Say what you want to press after the question.", lines.last())
    }

    @Test fun `repeat invalidates the prior completion without advancing`() {
        val guide = OnboardingGuide()
        val first = requireNotNull(guide.prompt)
        val repeated = requireNotNull(guide.repeat())
        assertEquals(first.text, repeated.text)
        assertNotEquals(first.id, repeated.id)
        guide.speechDone(first.id)
        assertEquals(repeated, guide.prompt)
        guide.speechDone(repeated.id)
        assertNotEquals(repeated.text, guide.prompt?.text)
    }

    @Test fun `stale callbacks cannot skip instructions`() {
        val guide = OnboardingGuide()
        val first = requireNotNull(guide.prompt)
        guide.speechDone(first.id)
        val second = guide.prompt
        guide.speechDone(first.id)
        assertEquals(second, guide.prompt)
    }

    @Test fun `skip completes once and ignores late callbacks or repeats`() {
        val guide = OnboardingGuide()
        val first = requireNotNull(guide.prompt)
        guide.skip()
        assertTrue(guide.complete)
        assertNull(guide.repeat())
        assertNull(guide.speechDone(first.id))
        assertNull(guide.prompt)
    }
}
