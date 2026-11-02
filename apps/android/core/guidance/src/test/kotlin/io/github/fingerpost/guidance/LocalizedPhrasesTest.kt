package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class LocalizedPhrasesTest {
    @Test fun rendersMovementAndCadenceInTheChosenLanguage() {
        val cue = GuideCue(listOf(Dir.LEFT), MagnitudeWord.A_LITTLE, true)
        for (locale in listOf("en", "hi", "es")) {
            val rendered = Phrases.render(cue, locale)!!
            assertTrue(rendered.contains(Strings.get(Key.SLOW_DOWN, locale)))
            assertTrue(rendered.lowercase().contains(Strings.get(Key.DIR_LEFT, locale)))
            assertTrue(rendered.contains(Strings.get(Key.A_LITTLE, locale)))
        }
    }
}
