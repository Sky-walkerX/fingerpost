package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

/** Days 4–7 plan, A5-1: local touch-explore names the element under the finger's pad (guidance-spec §8, §11a). */
class TouchExplorerTest {
    private fun box(id: String, label: String, role: String, u0: Double, v0: Double, u1: Double, v1: Double) =
        ExploreElement(id, label, role, listOf(Vec2(u0, v0), Vec2(u1, v0), Vec2(u1, v1), Vec2(u0, v1)))
    private val layout = listOf(
        box("start", "Start", "button", 0.0, 0.0, 0.4, 0.4),
        box("stop", "Stop", "button", 0.6, 0.0, 1.0, 0.4),
        box("total", "Total ₹149", "text", 0.0, 0.6, 1.0, 1.0),
    )
    private val inStart = Vec2(0.2, 0.2)
    private val inStop = Vec2(0.8, 0.2)
    private val gap = Vec2(0.5, 0.2)

    @Test fun speaksOnEnter() {
        val t = TouchExplorer()
        assertNull(t.update(0, inStart, layout))
        assertNull(t.update(149, inStart, layout))
        assertEquals(ExploreCue.Speak("Start", "button"), t.update(150, inStart, layout))
    }

    @Test fun briefPassOverAnElementSaysNothing() {
        val t = TouchExplorer()
        assertNull(t.update(0, inStart, layout))
        assertNull(t.update(100, inStart, layout))
        assertNull(t.update(120, gap, layout))
        assertNull(t.update(400, gap, layout))
    }

    @Test fun noRepeatWhileInside() {
        val t = TouchExplorer()
        t.update(0, inStart, layout); t.update(150, inStart, layout)
        for (ms in 200L..2_000L step 50) assertNull(t.update(ms, Vec2(0.21, 0.19), layout))
    }

    @Test fun edgeEarconOnLeave() {
        val t = TouchExplorer()
        t.update(0, inStart, layout); t.update(150, inStart, layout)
        assertEquals(ExploreCue.Edge, t.update(200, gap, layout))
        assertNull(t.update(400, gap, layout))
    }

    @Test fun movingStraightToAnotherElementPlaysEdgeThenSpeaksIt() {
        val t = TouchExplorer()
        t.update(0, inStart, layout); t.update(150, inStart, layout)
        assertEquals(ExploreCue.Edge, t.update(200, inStop, layout))
        assertNull(t.update(300, inStop, layout))
        assertEquals(ExploreCue.Speak("Stop", "button"), t.update(350, inStop, layout))
    }

    @Test fun noFingerNeverSpeaksAndRestartsTheDebounce() {
        val t = TouchExplorer()
        assertNull(t.update(0, inStart, layout))
        assertNull(t.update(100, null, layout))
        assertNull(t.update(200, inStart, layout))
        assertNull(t.update(300, inStart, layout))
        assertEquals(ExploreCue.Speak("Start", "button"), t.update(350, inStart, layout))
    }

    @Test fun textRoleSpokenWithPrefix() {
        val t = TouchExplorer()
        t.update(0, Vec2(0.5, 0.8), layout)
        val cue = t.update(150, Vec2(0.5, 0.8), layout)
        assertEquals(ExploreCue.Speak("Total ₹149", "text"), cue)
        cue as ExploreCue.Speak
        assertEquals("Text: Total ₹149", cue.spoken(Strings.EN))
        assertEquals("टेक्स्ट: Total ₹149", cue.spoken(Strings.HI))
        assertEquals("Texto: Total ₹149", cue.spoken(Strings.ES))
        assertEquals("Start", ExploreCue.Speak("Start", "button").spoken(Strings.EN))
    }

    @Test fun resetForgetsTheCurrentElement() {
        val t = TouchExplorer()
        t.update(0, inStart, layout); t.update(150, inStart, layout)
        t.reset()
        assertNull(t.update(200, inStart, layout))
        assertEquals(ExploreCue.Speak("Start", "button"), t.update(350, inStart, layout))
    }

    @Test fun touchExploreCommandInAllThreeLanguages() {
        for (said in listOf("touch explore", "Touch explore.", "turn on touch explore", "टच एक्सप्लोर", "exploración táctil", "Exploracion tactil"))
            assertTrue(isTouchExploreCommand(said), said)
        for (said in listOf("more", "explore", "press start", "और", "más", "touchscreen settings"))
            assertFalse(isTouchExploreCommand(said), said)
    }
}
