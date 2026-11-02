package io.github.fingerpost.engine

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Bundle
import android.os.Handler
import android.speech.tts.UtteranceProgressListener
import java.io.File
import android.os.Looper
import android.speech.tts.TextToSpeech
import java.util.Locale

/**
 * guidance-spec §10 on the phone. PIN help speaks only while earphones are the audio route, through its own
 * TextToSpeech, so digits never pass through the shared speech queue. Nothing here logs, stores or publishes
 * what it speaks. If the earphones go away mid-entry, speech stops at once and [onEarphonesLost] runs.
 */
class PinMode(context: Context, private val onEarphonesLost: () -> Unit,
    private val onVoiceUnavailable: (String) -> Unit = {}) {
    private val audio = context.getSystemService(AudioManager::class.java)
    private val main = Handler(Looper.getMainLooper())
    private var rate = 1.0f
    private var ready = false
    private var initialized = false
    private var locale = Locale.forLanguageTag("en-IN")
    private val warnedLanguages = mutableSetOf<String>()
    private var closed = false
    private var active = false
    private val tts = TextToSpeech(context.applicationContext) { status -> main.post { initialized(status) } }

    private val playback = PinPlayback { id, sampleRate, encoding, channels ->
        audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).firstOrNull { it.type in PinAudioOutput.EARPHONES }
            ?.let { device -> PinAudioOutput.create(device, main, sampleRate, encoding, channels) { failed(id) } }
    }

    private fun failed(id: String) { main.post {
        if (active && playback.isCurrent(id)) {
            playback.stop(); tts.stop(); onEarphonesLost()
        }
    } }

    private val devices = object : AudioDeviceCallback() {
        override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>) {
            if (active && !earphonesConnected()) {
                playback.stop(); tts.stop()
                onEarphonesLost()
            }
        }
    }

    private fun initialized(status: Int) {
        if (closed || status != TextToSpeech.SUCCESS) return
        tts.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String) = Unit
            override fun onDone(utteranceId: String) { playback.finish(utteranceId) }
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String) { failed(utteranceId) }
            override fun onError(utteranceId: String, errorCode: Int) { failed(utteranceId) }
            override fun onBeginSynthesis(utteranceId: String, sampleRateInHz: Int, audioFormat: Int, channelCount: Int) {
                if (!playback.begin(utteranceId, sampleRateInHz, audioFormat, channelCount)) failed(utteranceId)
            }
            override fun onAudioAvailable(utteranceId: String, audio: ByteArray) {
                if (!playback.audio(utteranceId, audio)) failed(utteranceId)
                audio.fill(0)
            }
        })
        initialized = true
        tts.setSpeechRate(rate)
        applyLanguage()
    }

    fun setRate(value: Float) {
        require(value.isFinite() && value > 0f) { "Invalid speech rate" }
        rate = value
        if (initialized && !closed) tts.setSpeechRate(value)
    }

    fun setLocale(tag: String) {
        if (closed) return
        locale = when (Locale.forLanguageTag(tag).language) {
            "hi" -> Locale.forLanguageTag("hi-IN")
            "es" -> Locale.forLanguageTag("es-ES")
            else -> Locale.forLanguageTag("en-IN")
        }
        if (initialized) { playback.stop(); tts.stop(); applyLanguage() }
    }

    private fun applyLanguage() {
        val result = tts.setLanguage(locale)
        ready = result >= TextToSpeech.LANG_AVAILABLE
        if (!ready && locale.language in setOf("hi", "es")) {
            ready = tts.setLanguage(Locale.forLanguageTag("en-IN")) >= TextToSpeech.LANG_AVAILABLE
            if (warnedLanguages.add(locale.language)) {
                val key = if (locale.language == "hi") io.github.fingerpost.guidance.Key.HINDI_VOICE_MISSING
                    else io.github.fingerpost.guidance.Key.SPANISH_VOICE_MISSING
                // Only this non-sensitive warning goes to the shared speaker; digits stay in speak().
                onVoiceUnavailable(io.github.fingerpost.guidance.Strings.get(key, "en"))
            }
        }
        // A PIN must not be sent to a network-backed TTS voice.
        if (ready) {
            val voice = tts.voices?.firstOrNull { !it.isNetworkConnectionRequired && it.locale.language == tts.voice?.locale?.language }
            ready = voice != null && tts.setVoice(voice) == TextToSpeech.SUCCESS
        }
    }

    /** Wired, USB, Bluetooth A2DP or BLE audio output present (guidance-spec §10). */
    fun earphonesConnected(): Boolean =
        audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any { it.type in EARPHONES }

    fun start() {
        if (active || closed) return
        active = true
        audio.registerAudioDeviceCallback(devices, main)
    }

    /** Speaks only through earphones. False when nothing was spoken (inactive, not ready, or no earphones). */
    fun speak(text: String): Boolean {
        if (!active || !ready || closed || !earphonesConnected()) return false
        playback.stop(); tts.stop()
        val id = playback.newUtterance()
        // Synthesis has no system playback. /dev/null discards the WAV; callbacks deliver transient PCM
        // to our route-checked AudioTrack. There is no speech file or speaker fallback.
        val accepted = runCatching { tts.synthesizeToFile(text, Bundle(), File("/dev/null"), id) }.getOrDefault(TextToSpeech.ERROR)
        if (accepted == TextToSpeech.ERROR) { playback.stop(); return false }
        return true
    }

    fun stop() {
        if (!active) return
        active = false
        playback.stop(); tts.stop()
        audio.unregisterAudioDeviceCallback(devices)
    }

    fun shutdown() {
        stop()
        closed = true
        tts.shutdown()
    }

    private companion object {
        val EARPHONES = setOf(
            AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_USB_HEADSET, AudioDeviceInfo.TYPE_BLE_HEADSET,
        )
    }
}
