package io.github.fingerpost.engine

import android.media.AudioManager
import android.media.ToneGenerator

/**
 * Touch-explore earcons (Days 4–7 plan, A5-1; guidance-spec §11a): a short beep on the accessibility stream
 * when the finger slides off an element, so the user hears the edge without speech.
 */
class Earcons {
    private val generator = runCatching { ToneGenerator(AudioManager.STREAM_ACCESSIBILITY, 25) }.getOrNull()

    fun edge() { generator?.startTone(ToneGenerator.TONE_PROP_BEEP2, 30) }

    /** The microphone just opened: speak now. */
    fun listening() { generator?.startTone(ToneGenerator.TONE_PROP_ACK, 120) }
    fun release() { generator?.release() }
}
