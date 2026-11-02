package io.github.fingerpost.engine

import android.media.AudioAttributes
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.util.Locale

class TtsSpeakerTest {

    private class FakeTtsEngine(var languageResult: Int = TextToSpeech.LANG_AVAILABLE) : TtsEngine {
        var offlineAvailable = true
        val offlineRequests = mutableListOf<Locale>()
        override fun useOfflineVoice(locale: Locale): Boolean { offlineRequests += locale; return offlineAvailable }
        val spoken = mutableListOf<String>()
        val rates = mutableListOf<Float>()
        override fun setSpeechRate(rate: Float): Int { rates += rate; return 0 }
        val languagesSet = mutableListOf<Locale>()
        var listener: UtteranceProgressListener? = null

        override fun setAudioAttributes(attributes: AudioAttributes): Int = 0

        override fun setLanguage(loc: Locale): Int {
            languagesSet += loc
            return languageResult
        }

        override fun setOnUtteranceProgressListener(listener: UtteranceProgressListener) {
            this.listener = listener
        }

        override fun speak(text: CharSequence, queueMode: Int, params: Bundle?, utteranceId: String): Int {
            spoken += text.toString()
            return TextToSpeech.SUCCESS
        }

        override fun stop(): Int = 0
        override fun shutdown() {}
    }

    @Test
    fun hindiVoiceMissingDataSpeaksEnglishWarningOnce() {
        val fakeEngine = FakeTtsEngine(languageResult = TextToSpeech.LANG_MISSING_DATA)
        val speaker = TtsSpeaker(context = null, onDone = {}, onError = {}, engine = fakeEngine)

        speaker.setLanguage(Locale.forLanguageTag("hi-IN"))

        assertEquals(1, fakeEngine.spoken.size)
        assertEquals("Hindi voice not installed; using English.", fakeEngine.spoken[0])
        assertEquals(Locale.forLanguageTag("en-IN"), fakeEngine.languagesSet.last())

        // Second call with same locale does not repeat warning
        speaker.setLanguage(Locale.forLanguageTag("hi-IN"))
        assertEquals(1, fakeEngine.spoken.size)
    }

    @Test
    fun spanishVoiceMissingDataSpeaksEnglishWarningOnce() {
        val fakeEngine = FakeTtsEngine(languageResult = TextToSpeech.LANG_MISSING_DATA)
        val speaker = TtsSpeaker(context = null, onDone = {}, onError = {}, engine = fakeEngine)

        speaker.setLanguage(Locale.forLanguageTag("es-ES"))

        assertEquals(1, fakeEngine.spoken.size)
        assertEquals("Spanish voice not installed; using English.", fakeEngine.spoken[0])
        assertEquals(Locale.forLanguageTag("en-IN"), fakeEngine.languagesSet.last())
    }

    @Test
    fun languageAvailableSpeaksNoWarning() {
        val fakeEngine = FakeTtsEngine(languageResult = TextToSpeech.LANG_AVAILABLE)
        val speaker = TtsSpeaker(context = null, onDone = {}, onError = {}, engine = fakeEngine)

        speaker.setLanguage(Locale.forLanguageTag("hi-IN"))

        assertTrue(fakeEngine.spoken.isEmpty())
        assertEquals(Locale.forLanguageTag("hi-IN"), fakeEngine.languagesSet.last())
    }
    @Test fun appliesSpeechRateWithoutDroppingTheCurrentUtterance() {
        val engine = FakeTtsEngine()
        var completed = false
        val speaker = TtsSpeaker(null, { completed = true }, {}, engine)
        speaker.setRate(1.5f)
        speaker.speak(io.github.fingerpost.guidance.Utterance("Synthetic cue", io.github.fingerpost.guidance.Priority.GUIDE, 0), false)
        speaker.setRate(0.75f)
        engine.listener!!.onDone("fp-1")
        assertEquals(listOf(1.0f, 1.5f, 0.75f), engine.rates)
        assertTrue(completed)
        org.junit.jupiter.api.assertThrows<IllegalArgumentException> { speaker.setRate(Float.NaN) }
    }

    @Test fun offlineModeRequiresALocalVoiceAndCanSafelyReturnToOnlineSpeech() {
        val engine = FakeTtsEngine()
        var errors = 0
        val speaker = TtsSpeaker(null, {}, { errors++ }, engine)
        speaker.setOfflineOnly(true)
        speaker.speak(io.github.fingerpost.guidance.Utterance("Synthetic offline cue", io.github.fingerpost.guidance.Priority.GUIDE, 0), false)
        assertEquals(listOf("Synthetic offline cue"), engine.spoken)
        assertTrue(engine.offlineRequests.isNotEmpty())
        engine.offlineAvailable = false
        speaker.setOfflineOnly(true)
        speaker.speak(io.github.fingerpost.guidance.Utterance("Protected synthetic label", io.github.fingerpost.guidance.Priority.GUIDE, 1), false)
        assertFalse(engine.spoken.contains("Protected synthetic label")); assertEquals(1, errors)
        speaker.setOfflineOnly(false)
        speaker.speak(io.github.fingerpost.guidance.Utterance("Synthetic online cue", io.github.fingerpost.guidance.Priority.STATE, 2), false)
        assertEquals("Synthetic online cue", engine.spoken.last())
    }

}
