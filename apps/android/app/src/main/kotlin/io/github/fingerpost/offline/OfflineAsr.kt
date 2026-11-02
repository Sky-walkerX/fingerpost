package io.github.fingerpost.offline

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

internal interface OfflineRecognizer {
    fun start(languageTag: String)
    fun cancel()
    fun destroy()
}
internal interface OfflineSpeechEvents {
    fun final(text: String?)
    fun unavailable()
    fun retry()
}
internal fun interface OfflineSpeechPlatform {
    /** Null means on-device recognition is unavailable. A generic/cloud recognizer is never an alternative. */
    fun create(events: OfflineSpeechEvents): OfflineRecognizer?
}

/** Main-thread local speech lifecycle. Cancelled or replaced utterances cannot submit stale results. */
class OfflineAsr internal constructor(
    private val platform: OfflineSpeechPlatform,
    private val onFinal: (String) -> Unit,
    private val onUnavailable: () -> Unit,
) {
    constructor(context: Context, onFinal: (String) -> Unit, onUnavailable: () -> Unit) :
        this(AndroidOfflineSpeech(context), onFinal, onUnavailable)

    private var recognizer: OfflineRecognizer? = null
    private var generation = 0L
    private var closed = false
    var isListening = false; private set

    fun listen(languageTag: String) {
        if (closed || isListening) return
        val id = ++generation
        isListening = true
        val events = object : OfflineSpeechEvents {
            private fun active() = !closed && isListening && generation == id
            override fun final(text: String?) {
                if (!active()) return
                stop()
                text?.takeIf { it.isNotBlank() }?.let(onFinal)
            }
            override fun unavailable() {
                if (!active()) return
                stop(); onUnavailable()
            }
            override fun retry() { if (active()) stop() }
        }
        val created = runCatching { platform.create(events) }.getOrNull()
        if (closed || generation != id) { created?.let { runCatching { it.destroy() } }; return }
        recognizer = created
        if (created == null) { events.unavailable(); return }
        try { created.start(languageTag) } catch (_: Exception) { events.unavailable() }
    }

    fun stop() {
        generation++; isListening = false
        val previous = recognizer
        recognizer = null
        previous?.let { runCatching { it.cancel() }; runCatching { it.destroy() } }
    }

    fun close() { closed = true; stop() }
}

private class AndroidOfflineSpeech(private val context: Context) : OfflineSpeechPlatform {
    override fun create(events: OfflineSpeechEvents): OfflineRecognizer? {
        if (Build.VERSION.SDK_INT < 31 || !SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) return null
        val recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
        recognizer.setRecognitionListener(object : RecognitionListener {
            override fun onResults(results: Bundle?) {
                events.final(results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull())
            }
            override fun onError(error: Int) {
                when (error) {
                    SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT,
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> events.retry()
                    else -> events.unavailable()
                }
            }
            override fun onReadyForSpeech(params: Bundle?) = Unit
            override fun onBeginningOfSpeech() = Unit
            override fun onRmsChanged(rmsdB: Float) = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onEndOfSpeech() = Unit
            override fun onPartialResults(partialResults: Bundle?) = Unit
            override fun onEvent(eventType: Int, params: Bundle?) = Unit
        })
        return object : OfflineRecognizer {
            override fun start(languageTag: String) {
                recognizer.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
                    .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1))
            }
            override fun cancel() = recognizer.cancel()
            override fun destroy() = recognizer.destroy()
        }
    }
}
