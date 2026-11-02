package io.github.fingerpost.offline

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

/**
 * Days 4–7 plan, A6-1: on-device speech for basic mode. Android's SpeechRecognizer with EXTRA_PREFER_OFFLINE,
 * one utterance per [listen]. Main thread only. Transcripts go to [onFinal] and are never logged or stored.
 * [onUnavailable] fires when this phone can't recognise speech offline (no service or no language pack).
 */
class OfflineAsr(
    private val context: Context,
    private val onFinal: (String) -> Unit,
    private val onUnavailable: () -> Unit,
) {
    private var recognizer: SpeechRecognizer? = null
    var isListening = false; private set

    private val listener = object : RecognitionListener {
        override fun onResults(results: Bundle?) {
            isListening = false
            results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.takeIf { it.isNotBlank() }?.let(onFinal)
        }
        override fun onError(error: Int) {
            isListening = false
            // Silence or no match: the engine listens again on its next tick, and the state machine's timeouts re-prompt.
            if (error == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED || error == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE
                || error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) onUnavailable()
        }
        override fun onReadyForSpeech(params: Bundle?) = Unit
        override fun onBeginningOfSpeech() = Unit
        override fun onRmsChanged(rmsdB: Float) = Unit
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEndOfSpeech() = Unit
        override fun onPartialResults(partialResults: Bundle?) = Unit
        override fun onEvent(eventType: Int, params: Bundle?) = Unit
    }

    fun listen(languageTag: String) {
        if (isListening) return
        if (!SpeechRecognizer.isRecognitionAvailable(context)) { onUnavailable(); return }
        val r = recognizer ?: SpeechRecognizer.createSpeechRecognizer(context).also { it.setRecognitionListener(listener); recognizer = it }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        isListening = true
        r.startListening(intent)
    }

    fun stop() {
        if (!isListening) return
        isListening = false
        recognizer?.cancel()
    }

    fun close() {
        isListening = false
        recognizer?.destroy()
        recognizer = null
    }
}
