package io.github.fingerpost

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.media.AudioManager
import android.os.Bundle
import android.speech.tts.TextToSpeech
import io.github.fingerpost.engine.TtsSpeaker
import io.github.fingerpost.guidance.Priority
import io.github.fingerpost.guidance.Utterance
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** Exercises the production speech adapter on the phone without opening its camera or microphone. */
internal object DeviceSpeechCheck {
    fun run(instrumentation: Instrumentation) {
        val context = instrumentation.targetContext
        val engines = context.packageManager.queryIntentServices(Intent(TextToSpeech.Engine.INTENT_ACTION_TTS_SERVICE), 0).size
        val audio = context.getSystemService(AudioManager::class.java)
        val done = AtomicBoolean(false)
        val failed = AtomicBoolean(false)
        val terminal = CountDownLatch(1)
        var speaker: TtsSpeaker? = null
        instrumentation.runOnMainSync {
            speaker = TtsSpeaker(context, onDone = { done.set(true); terminal.countDown() },
                onError = { failed.set(true); terminal.countDown() })
            speaker.speak(Utterance("Fingerpost voice test.", Priority.STATE, 0), false)
        }
        val callback = terminal.await(20, TimeUnit.SECONDS)
        instrumentation.runOnMainSync { speaker?.shutdown() }
        val passed = (if (engines > 0) 1 else 0) + (if (done.get() && !failed.get()) 1 else 0)
        val result = Bundle().apply {
            putInt("tests", 2); putInt("passed", passed); putInt("failed", 2 - passed)
            putInt("visibleEngines", engines)
            putBoolean("speechCompleted", done.get())
            putBoolean("speechError", failed.get())
            putBoolean("callbackReceived", callback)
            putInt("mediaVolume", audio.getStreamVolume(AudioManager.STREAM_MUSIC))
            putInt("accessibilityVolume", audio.getStreamVolume(AudioManager.STREAM_ACCESSIBILITY))
            putBoolean("accessibilityMuted", audio.isStreamMute(AudioManager.STREAM_ACCESSIBILITY))
        }
        instrumentation.finish(if (passed == 2) Activity.RESULT_OK else Activity.RESULT_CANCELED, result)
    }
}
