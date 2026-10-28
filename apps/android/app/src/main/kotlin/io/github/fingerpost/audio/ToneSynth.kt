package io.github.fingerpost.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Process
import android.util.Log
import io.github.fingerpost.BuildConfig
import io.github.fingerpost.guidance.ToneGenerator
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** The audio thread alone owns AudioTrack; stopping ramps to silence without resetting phase. */
class ToneSynth {
    private data class Controls(
        val frequencyHz: Double = 220.0, val pan: Double = 0.0,
        val enabled: Boolean = false, val released: Boolean = false,
    )

    private val controls = AtomicReference(Controls())
    private val started = CountDownLatch(1)
    private val mutableUnavailable = MutableStateFlow(false)
    val unavailable: StateFlow<Boolean> = mutableUnavailable.asStateFlow()

    init {
        thread(name = "FingerpostTone") {
            var track: AudioTrack? = null
            try {
                Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
                started.await()
                if (controls.get().released) return@thread
                val minimum = AudioTrack.getMinBufferSize(ToneGenerator.SAMPLE_RATE,
                    AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_FLOAT)
                check(minimum > 0)
                val audioTrack = AudioTrack.Builder()
                    .setAudioAttributes(AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                    .setAudioFormat(AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
                        .setSampleRate(ToneGenerator.SAMPLE_RATE)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO).build())
                    .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .setBufferSizeInBytes(maxOf(minimum, ToneGenerator.BLOCK_FRAMES * 2 * Float.SIZE_BYTES))
                    .build()
                track = audioTrack
                check(audioTrack.state == AudioTrack.STATE_INITIALIZED)
                if (controls.get().released) return@thread
                val generator = ToneGenerator()
                val buffer = FloatArray(ToneGenerator.BLOCK_FRAMES * 2)
                audioTrack.play()
                if (BuildConfig.DEBUG) Log.i("FingerpostTone",
                    "sampleRate=${audioTrack.sampleRate} bufferFrames=${audioTrack.bufferSizeInFrames} performanceMode=${audioTrack.performanceMode}")
                while (!controls.get().released) {
                    val current = controls.get()
                    generator.render(buffer, current.frequencyHz, current.pan, current.enabled)
                    var offset = 0
                    while (offset < buffer.size && !controls.get().released) {
                        val written = audioTrack.write(buffer, offset, buffer.size - offset, AudioTrack.WRITE_BLOCKING)
                        check(written > 0)
                        offset += written
                    }
                }
            } catch (_: RuntimeException) {
                if (!controls.get().released) mutableUnavailable.value = true
            } catch (_: InterruptedException) {
                if (!controls.get().released) mutableUnavailable.value = true
                Thread.currentThread().interrupt()
            } finally {
                track?.let { audioTrack ->
                    try {
                        audioTrack.pause()
                        audioTrack.flush()
                    } catch (_: IllegalStateException) {
                        // A failed output device can invalidate an otherwise initialized track.
                    } finally {
                        audioTrack.release()
                    }
                }
            }
        }
    }

    fun start() {
        controls.updateAndGet { if (it.released) it else it.copy(enabled = true) }
        started.countDown()
    }

    fun stop() {
        controls.updateAndGet { it.copy(enabled = false) }
    }

    fun setFrequency(hz: Double) {
        require(hz.isFinite())
        controls.updateAndGet { if (it.released) it else it.copy(frequencyHz = hz) }
    }

    fun setPan(pan: Double) {
        require(pan.isFinite())
        controls.updateAndGet { if (it.released) it else it.copy(pan = pan) }
    }

    fun release() {
        controls.updateAndGet { it.copy(enabled = false, released = true) }
        started.countDown()
    }
}
