package io.github.fingerpost.engine

import android.content.Context
import android.media.AudioAttributes
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import io.github.fingerpost.guidance.Priority
import io.github.fingerpost.guidance.Utterance
import java.util.Locale

internal interface TtsEngine {
    fun setAudioAttributes(attributes: AudioAttributes): Int
    fun setLanguage(loc: Locale): Int
    fun setOnUtteranceProgressListener(listener: UtteranceProgressListener)
    fun speak(text: CharSequence, queueMode: Int, params: Bundle?, utteranceId: String): Int
    fun stop(): Int
    fun shutdown()
}

/** Only a successful callback for the current utterance can complete a state-machine prompt. */
class TtsSpeaker internal constructor(
    context: Context?,
    private val onDone: (Utterance) -> Unit,
    private val onError: (Utterance?) -> Unit = {},
    engine: TtsEngine?,
) {
    constructor(context: Context, onDone: (Utterance) -> Unit, onError: (Utterance?) -> Unit = {}) :
        this(context, onDone, onError, null)

    private var ready = false
    private var closed = false
    private var currentId: String? = null
    private var current: Utterance? = null
    private var failed = false
    private var seq = 0L
    private var pending: Utterance? = null
    private var locale = "en-IN"
    private var targetLocale = Locale.forLanguageTag("en-IN")
    private val warnedLanguages = mutableSetOf<String>()
    private val main: Handler? = try { Handler(Looper.getMainLooper()) } catch (_: Throwable) { null }
    private val tts: TtsEngine

    init {
        if (engine != null) {
            tts = engine
            initialized(TextToSpeech.SUCCESS)
        } else {
            requireNotNull(context) { "Context is required when engine is not supplied" }
            lateinit var realTts: TextToSpeech
            realTts = TextToSpeech(context.applicationContext) { status ->
                main?.post { initialized(status) } ?: initialized(status)
            }
            tts = object : TtsEngine {
                override fun setAudioAttributes(attributes: AudioAttributes): Int = realTts.setAudioAttributes(attributes)
                override fun setLanguage(loc: Locale): Int = realTts.setLanguage(loc)
                override fun setOnUtteranceProgressListener(listener: UtteranceProgressListener) {
                    realTts.setOnUtteranceProgressListener(listener)
                }
                override fun speak(text: CharSequence, queueMode: Int, params: Bundle?, utteranceId: String): Int =
                    realTts.speak(text, queueMode, params, utteranceId)
                override fun stop(): Int = realTts.stop()
                override fun shutdown() = realTts.shutdown()
            }
        }
    }

    @Synchronized internal fun initialized(status: Int) {
        if (closed) return
        if (status != TextToSpeech.SUCCESS) {
            failed = true
            val skipped = pending
            pending = null
            onError(skipped)
            return
        }
        try {
            tts.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
        } catch (_: Throwable) {
            // Unit tests / stubs
        }
        ready = true
        applyLanguage(targetLocale)
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String) = Unit
            override fun onDone(utteranceId: String) = finished(utteranceId, true)
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String) = finished(utteranceId, false)
            override fun onError(utteranceId: String, errorCode: Int) = finished(utteranceId, false)
        })
        pending?.let { pending = null; speak(it, false) }
    }

    @Synchronized fun setLocale(tag: String) {
        locale = tag
        val loc = when (tag.lowercase()) {
            "hi", "hi-in" -> Locale.forLanguageTag("hi-IN")
            "es", "es-es" -> Locale.forLanguageTag("es-ES")
            "en", "en-in" -> Locale.forLanguageTag("en-IN")
            else -> Locale.forLanguageTag(tag)
        }
        setLanguage(loc)
    }

    @Synchronized fun setLanguage(loc: Locale): Int {
        targetLocale = loc
        if (!ready) return TextToSpeech.LANG_NOT_SUPPORTED
        return applyLanguage(loc)
    }

    private fun applyLanguage(loc: Locale): Int {
        val result = tts.setLanguage(loc)
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            val lang = loc.language.lowercase()
            if (lang in setOf("hi", "es") && warnedLanguages.add(lang)) {
                val warning = if (lang == "hi") "Hindi voice not installed; using English."
                else "Spanish voice not installed; using English."
                tts.setLanguage(Locale.forLanguageTag("en-IN"))
                speak(Utterance(warning, Priority.STATE, System.currentTimeMillis()), interrupt = false)
            }
        }
        return result
    }

    @Synchronized fun speak(u: Utterance, interrupt: Boolean) {
        if (closed) return
        if (failed) { onError(u); return }
        if (!ready) { pending = u; return }
        currentId = null
        if (interrupt) tts.stop()
        val id = "fp-${++seq}"
        current = u
        currentId = id
        if (tts.speak(u.text, TextToSpeech.QUEUE_FLUSH, null, id) == TextToSpeech.ERROR) finished(id, false)
    }

    @Synchronized private fun finished(id: String, success: Boolean) {
        if (closed || id != currentId) return
        currentId = null
        val finished = current
        current = null
        if (success && finished != null) onDone(finished) else onError(finished)
    }

    @Synchronized fun stop() {
        currentId = null; current = null; pending = null
        tts.stop()
    }

    @Synchronized fun shutdown() { closed = true; stop(); tts.shutdown() }
}
