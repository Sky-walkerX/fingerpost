package io.github.fingerpost.offline

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class OfflineAsrTest {
    private class Engine : OfflineRecognizer {
        var starts = 0; var cancelled = 0; var destroyed = 0; var language = ""
        override fun start(languageTag: String) { starts++; language = languageTag }
        override fun cancel() { cancelled++ }
        override fun destroy() { destroyed++ }
    }
    @Test fun unavailableOnDeviceServiceNeverFallsBackToAGenericRecognizer() {
        var unavailable = 0; var creates = 0
        val asr = OfflineAsr(OfflineSpeechPlatform { creates++; null }, {}, { unavailable++ })
        asr.listen("hi-IN")
        assertEquals(1, creates); assertEquals(1, unavailable); assertFalse(asr.isListening)
    }
    @Test fun oneUtteranceKeepsTheSelectedLanguageAndReleasesTheRecognizer() {
        val engine = Engine(); var events: OfflineSpeechEvents? = null; var heard = ""
        val asr = OfflineAsr(OfflineSpeechPlatform { events = it; engine }, { heard = it }, {})
        asr.listen("es-ES"); asr.listen("en-US")
        assertEquals(1, engine.starts); assertEquals("es-ES", engine.language); assertTrue(asr.isListening)
        events!!.final("Synthetic goal")
        assertEquals("Synthetic goal", heard); assertFalse(asr.isListening); assertEquals(1, engine.destroyed)
    }
    @Test fun cancelledAndReplacedCallbacksCannotSubmitOldSpeechOrStopTheNewUtterance() {
        val listeners = mutableListOf<OfflineSpeechEvents>(); var heard = 0
        val asr = OfflineAsr(OfflineSpeechPlatform { listeners += it; Engine() }, { heard++ }, {})
        asr.listen("en-US"); asr.stop(); asr.listen("hi-IN")
        listeners[0].final("Stale synthetic goal"); listeners[0].unavailable()
        assertEquals(0, heard); assertTrue(asr.isListening)
        listeners[1].final("Current synthetic goal"); assertEquals(1, heard); assertFalse(asr.isListening)
        asr.close(); asr.listen("es-ES"); assertEquals(2, listeners.size)
    }
    @Test fun initializationAndStartExceptionsFailSafelyWithoutLeavingTheMicrophoneActive() {
        var unavailable = 0
        val fail = OfflineAsr(OfflineSpeechPlatform { throw IllegalStateException("synthetic") }, {}, { unavailable++ })
        fail.listen("en-US"); assertEquals(1, unavailable); assertFalse(fail.isListening)
        var destroyed = false
        val asr = OfflineAsr(OfflineSpeechPlatform { object : OfflineRecognizer {
            override fun start(languageTag: String) { throw SecurityException("synthetic") }
            override fun cancel() = Unit
            override fun destroy() { destroyed = true }
        } }, {}, { unavailable++ })
        asr.listen("en-US"); assertEquals(2, unavailable); assertFalse(asr.isListening); assertTrue(destroyed)
    }
}
