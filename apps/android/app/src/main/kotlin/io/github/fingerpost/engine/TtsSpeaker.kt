package io.github.fingerpost.engine

import android.content.Context
import android.media.AudioAttributes
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import io.github.fingerpost.guidance.Utterance
import java.util.Locale

/** Only a successful callback for the current utterance can complete a state-machine prompt. */
class TtsSpeaker(context: Context, private val onDone: (Utterance) -> Unit, private val onError: (Utterance?) -> Unit = {}) {
    private var ready = false
    private var closed = false
    private var currentId: String? = null
    private var current: Utterance? = null
    private var failed = false
    private var seq = 0L
    private var pending: Utterance? = null
    private var locale = "en-IN"
    private val main = Handler(Looper.getMainLooper())
    private val tts = TextToSpeech(context.applicationContext) { status -> main.post { initialized(status) } }

    @Synchronized private fun initialized(status: Int) {
        if (closed) return
        if (status != TextToSpeech.SUCCESS) {
            failed = true
            val skipped = pending
            pending = null
            onError(skipped)
            return
        }
        tts.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
        tts.setLanguage(Locale.forLanguageTag(locale))
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String) = Unit
            override fun onDone(utteranceId: String) = finished(utteranceId, true)
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String) = finished(utteranceId, false)
            override fun onError(utteranceId: String, errorCode: Int) = finished(utteranceId, false)
        })
        ready = true
        pending?.let { pending = null; speak(it, false) }
    }

    @Synchronized fun setLocale(tag: String) { locale = tag; if (ready) tts.setLanguage(Locale.forLanguageTag(tag)) }

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
