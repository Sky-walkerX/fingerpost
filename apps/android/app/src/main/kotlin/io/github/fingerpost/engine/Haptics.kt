package io.github.fingerpost.engine

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import io.github.fingerpost.guidance.HapticKind

/** design §3.4 haptics: a light tick on a boundary, a strong double click on target, a long buzz when lost. */
class Haptics(context: Context) {
    private val vibrator: Vibrator =
        if (Build.VERSION.SDK_INT >= 31) context.getSystemService(VibratorManager::class.java).defaultVibrator
        else @Suppress("DEPRECATION") context.getSystemService(Vibrator::class.java)
    private val main = Handler(Looper.getMainLooper())
    private val earcon = runCatching { ToneGenerator(AudioManager.STREAM_ACCESSIBILITY, 25) }.getOrNull()

    fun play(kind: HapticKind) {
        when (kind) {
            HapticKind.TICK -> vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK))
            HapticKind.ON_TARGET -> {
                earcon?.startTone(ToneGenerator.TONE_PROP_ACK, 80)
                vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK))
                main.postDelayed({ vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK)) }, 120)
            }
            HapticKind.LOST -> vibrator.vibrate(VibrationEffect.createOneShot(300, VibrationEffect.DEFAULT_AMPLITUDE))
        }
    }

    /** The soft "framing is good" tick: an earcon, not speech (guidance-spec §8). */
    fun softTick() {
        earcon?.startTone(ToneGenerator.TONE_PROP_BEEP, 40)
    }

    fun release() {
        main.removeCallbacksAndMessages(null)
        vibrator.cancel()
        earcon?.release()
    }
}
