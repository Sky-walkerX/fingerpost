package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.util.Locale

class StringsTest {
    @Test fun framingAndRecoveryMessagesExistForEveryLanguage() {
        for (locale in listOf(Strings.EN, Strings.HI, Strings.ES)) {
            for (cue in FramingCue.entries) {
                assertEquals(cue == FramingCue.GOOD, Strings.framing(cue, locale).isEmpty())
            }
            assertTrue(Strings.get(Key.SPEECH_UNAVAILABLE, locale).isNotBlank())
            assertTrue(Strings.get(Key.CAMERA_RECOVERY, locale).isNotBlank())
        }
        assertEquals("Move closer.", Strings.framing(FramingCue.MOVE_CLOSER, Strings.EN))
        assertEquals("थोड़ा पास आएं।", Strings.framing(FramingCue.MOVE_CLOSER, Strings.HI))
        assertEquals("Acércate.", Strings.framing(FramingCue.MOVE_CLOSER, Strings.ES))
    }

    @Test fun updateNoticeUsesTheSelectedLanguage() {
        assertEquals("An update is available", Strings.get(Key.UPDATE_AVAILABLE, "en"))
        assertEquals("एक अपडेट उपलब्ध है", Strings.get(Key.UPDATE_AVAILABLE, "hi-IN"))
        assertEquals("Hay una actualización disponible", Strings.get(Key.UPDATE_AVAILABLE, "es-ES"))
    }

    @Test
    fun everyKeyHasAllThreeLocales() {
        val locales = listOf(Strings.EN, Strings.HI, Strings.ES)
        for (locale in locales) {
            val map = Strings.strings[locale]
            assertNotNull(map, "Strings map missing for locale $locale")
            for (key in Key.entries) {
                val text = map?.get(key)
                assertNotNull(text, "Missing translation for key $key in locale $locale")
                assertTrue(text?.isNotBlank() == true, "Translation for key $key in locale $locale must not be blank")
            }
        }
    }

    @Test
    fun englishMatchesOriginalPromptsAndTaskPrompts() {
        assertEquals("What do you want to press?", Strings.get(Key.ASK_GOAL, Locale.ENGLISH))
        assertEquals("Say what you want to press, for example: start.", Strings.get(Key.ASK_GOAL_AGAIN, Locale.ENGLISH))
        assertEquals("Tap the screen when you're ready.", Strings.get(Key.GIVE_UP_LISTENING, Locale.ENGLISH))
        assertEquals("Hold the phone about an arm's length from the screen, and point it straight at it.", Strings.get(Key.FRAMING_TIPS, Locale.ENGLISH))
        assertEquals("I couldn't read the screen. Let's try again.", Strings.get(Key.LOCATE_FAILED, Locale.ENGLISH))
        assertEquals("Raise your pointing finger into view.", Strings.get(Key.RAISE_FINGER, Locale.ENGLISH))
        assertEquals("Tap.", Strings.get(Key.TAP, Locale.ENGLISH))
        assertEquals("Press now.", Strings.get(Key.PRESS_NOW, Locale.ENGLISH))
        assertEquals("Having trouble? Say explore to hear what's on the screen.", Strings.get(Key.OFFER_EXPLORE, Locale.ENGLISH))
        assertEquals("Hold the phone steady.", Strings.get(Key.HOLD_STEADY, Locale.ENGLISH))

        assertEquals("Say yes to pay, or no to cancel.", Strings.get(Key.SAY_YES_OR_NO, Locale.ENGLISH))
        assertEquals("Payment not confirmed.", Strings.get(Key.PAYMENT_NOT_CONFIRMED, Locale.ENGLISH))
        assertEquals("I need you to confirm the amount first.", Strings.get(Key.CONFIRM_FIRST, Locale.ENGLISH))
        assertEquals("I lost track. What do you want to do?", Strings.get(Key.LOST_TRACK, Locale.ENGLISH))
        assertEquals("Tell me what you want to do.", Strings.get(Key.ASK_AGAIN_GIVE_UP, Locale.ENGLISH))
        assertEquals("Done.", Strings.get(Key.DONE, Locale.ENGLISH))
    }

    @Test
    fun languageTagLookupAndFallback() {
        assertEquals("ऊपर", Strings.get(Key.DIR_UP, "hi"))
        assertEquals("ऊपर", Strings.get(Key.DIR_UP, "hi-IN"))
        assertEquals("arriba", Strings.get(Key.DIR_UP, "es"))
        assertEquals("arriba", Strings.get(Key.DIR_UP, "es-ES"))
        assertEquals("up", Strings.get(Key.DIR_UP, "fr")) // fallback to English
    }

    @Test
    fun stateMachineEmitsLocalizedStringsForHindiAndSpanish() {
        val hiMachine = GuidanceStateMachine(Strings.HI)
        val hiEffects = hiMachine.handle(GEvent.Start(0))
        assertEquals(listOf(Effect.Say("आप क्या दबाना चाहते हैं?", Priority.STATE), Effect.OpenMic), hiEffects)

        val esMachine = GuidanceStateMachine(Strings.ES)
        val esEffects = esMachine.handle(GEvent.Start(0))
        assertEquals(listOf(Effect.Say("¿Qué quieres pulsar?", Priority.STATE), Effect.OpenMic), esEffects)
    }
}
