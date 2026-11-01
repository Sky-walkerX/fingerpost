package io.github.fingerpost.engine

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import java.util.Locale

/**
 * guidance-spec §10 on the phone. PIN help speaks only while earphones are the audio route, through its own
 * TextToSpeech, so digits never pass through the shared speech queue. Nothing here logs, stores or publishes
 * what it speaks. If the earphones go away mid-entry, speech stops at once and [onEarphonesLost] runs.
 */
class PinMode(context: Context, private val onEarphonesLost: () -> Unit) {
    private val audio = context.getSystemService(AudioManager::class.java)
    private val main = Handler(Looper.getMainLooper())
    private var ready = false
    private var closed = false
    private var active = false
    private val tts = TextToSpeech(context.applicationContext) { status -> main.post { initialized(status) } }

    private val devices = object : AudioDeviceCallback() {
        override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>) {
            if (active && !earphonesConnected()) {
                tts.stop()
                onEarphonesLost()
            }
        }
    }

    private fun initialized(status: Int) {
        if (closed || status != TextToSpeech.SUCCESS) return
        tts.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
        tts.setLanguage(Locale.forLanguageTag("en-IN"))
        ready = true
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
        return tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, UTTERANCE) != TextToSpeech.ERROR
    }

    fun stop() {
        if (!active) return
        active = false
        tts.stop()
        audio.unregisterAudioDeviceCallback(devices)
    }

    fun shutdown() {
        stop()
        closed = true
        tts.shutdown()
    }

    private companion object {
        const val UTTERANCE = "fp-pin"
        val EARPHONES = setOf(
            AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_USB_HEADSET, AudioDeviceInfo.TYPE_BLE_HEADSET,
        )
    }
}
