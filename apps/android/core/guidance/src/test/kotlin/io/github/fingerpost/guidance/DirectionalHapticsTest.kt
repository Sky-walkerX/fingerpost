package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class DirectionalHapticsTest {
    @Test fun directionsFollowDominantScreenAxis() {
        assertEquals(listOf(0L,80L,80L,80L), DirectionalHaptics.pattern(Vec2(-1.0,0.2)))
        assertEquals(listOf(0L,240L), DirectionalHaptics.pattern(Vec2(1.0,0.0)))
        assertEquals(listOf(0L,80L,80L,80L,80L,80L), DirectionalHaptics.pattern(Vec2(0.0,-1.0)))
        assertEquals(listOf(0L,240L,80L,80L), DirectionalHaptics.pattern(Vec2(0.0,1.0)))
        assertTrue(DirectionalHaptics.pattern(Vec2(Double.NaN,0.0)).isEmpty())
    }
    @Test fun repeatsFasterNearTargetWithoutOverlappingPatterns() {
        assertEquals(1200L, DirectionalHaptics.interval(1.0))
        assertEquals(600L, DirectionalHaptics.interval(0.01))
        assertTrue(DirectionalHaptics.interval(0.15)<DirectionalHaptics.interval(0.4))
        val h = DirectionalHaptics()
        assertNotNull(h.next(Vec2(-1.0,0.0),0))
        assertNull(h.next(Vec2(-1.0,0.0),1199))
        assertNotNull(h.next(Vec2(-1.0,0.0),1200))
        h.reset()
        assertNotNull(h.next(Vec2(-1.0,0.0),1201))
    }
    @Test fun tutorialHasFiveFourSecondLessonsInEveryLocale() {
        assertEquals(20_000L, HapticTutorial.durationMs)
        for (locale in listOf(Strings.EN,Strings.HI,Strings.ES)) {
            assertEquals(5,HapticTutorial.lessons(locale).size)
            assertTrue(HapticTutorial.lessons(locale).all { it.text.isNotBlank() && it.pattern.isNotEmpty() })
        }
    }
}
