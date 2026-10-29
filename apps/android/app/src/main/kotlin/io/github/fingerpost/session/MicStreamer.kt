package io.github.fingerpost.session

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import io.github.fingerpost.protocol.AudioEnd
import io.github.fingerpost.protocol.AudioHeader
import io.github.fingerpost.safety.UploadGuard
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread

/** Each utterance owns its recorder and stop flag, so a slow old read cannot join a restarted stream. */
class MicStreamer(private val client: SessionClient, private val guard: UploadGuard? = null) {
    private class Recording {
        val active = AtomicBoolean(true)
        @Volatile var recorder: AudioRecord? = null
    }
    private val current = AtomicReference<Recording?>()
    val isRunning: Boolean get() = current.get()?.active?.get() == true

    @SuppressLint("MissingPermission") // Runtime permission is checked by GuidanceEngine.
    fun start() {
        if (guard != null) guard.sendIfAllowed { startRecording(); true } else startRecording()
    }

    @SuppressLint("MissingPermission")
    private fun startRecording() {
        val recording = Recording()
        if (!current.compareAndSet(null, recording)) return
        thread(name = "FingerpostMic") {
            var record: AudioRecord? = null
            try {
                if (!recording.active.get()) return@thread
                val minimum = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
                record = AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, RATE, AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT, maxOf(minimum, 3200))
                synchronized(recording) {
                    recording.recorder = record
                    if (record.state != AudioRecord.STATE_INITIALIZED || !recording.active.get()) return@thread
                    record.startRecording()
                }
                val chunk = ByteArray(CHUNK_BYTES)
                var seq = 0
                while (recording.active.get()) {
                    var read = 0
                    while (read < chunk.size && recording.active.get()) {
                        val n = record.read(chunk, read, chunk.size - read)
                        if (n <= 0) break
                        read += n
                    }
                    if (read != chunk.size) break
                    val send = { synchronized(recording) {
                        recording.active.get() && client.send(AudioHeader(newId(), nowMs(), seq++), chunk.copyOf())
                    } }
                    if (guard != null) guard.sendIfAllowed(send) else send()
                }
            } catch (_: RuntimeException) {
                // Send only the utterance terminator; recorder errors contain no user content.
            } finally {
                synchronized(recording) {
                    if (recording.active.getAndSet(false)) client.send(AudioEnd(newId(), nowMs()))
                }
                current.compareAndSet(recording, null)
                record?.let { runCatching { it.stop() }; it.release() }
                recording.recorder = null
            }
        }
    }

    fun stop() {
        val recording = current.getAndSet(null) ?: return
        synchronized(recording) {
            if (recording.active.getAndSet(false)) client.send(AudioEnd(newId(), nowMs()))
        }
        runCatching { recording.recorder?.stop() }
    }

    private companion object { const val RATE = 16_000; const val CHUNK_BYTES = 640 }
}
