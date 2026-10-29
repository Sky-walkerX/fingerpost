package io.github.fingerpost.session

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import io.github.fingerpost.protocol.AudioEnd
import io.github.fingerpost.protocol.AudioHeader
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

/**
 * Streams 20 ms PCM16 chunks (16 kHz mono) to the session as binary `audio` frames; stop() sends `audio.end`.
 * The caller holds RECORD_AUDIO and never starts it in PIN mode.
 */
class MicStreamer(private val client: SessionClient) {
    private val running = AtomicBoolean(false)
    @Volatile private var worker: Thread? = null

    val isRunning: Boolean get() = running.get()

    @SuppressLint("MissingPermission") // checked by the caller before start()
    fun start() {
        if (!running.compareAndSet(false, true)) return
        worker = thread(name = "FingerpostMic") {
            val minimum = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            val record = try {
                AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, RATE, AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT, maxOf(minimum, 3200))
            } catch (_: RuntimeException) {
                running.set(false)
                return@thread
            }
            try {
                if (record.state != AudioRecord.STATE_INITIALIZED) return@thread
                record.startRecording()
                val chunk = ByteArray(CHUNK_BYTES)
                var seq = 0
                while (running.get()) {
                    var read = 0
                    while (read < chunk.size && running.get()) {
                        val n = record.read(chunk, read, chunk.size - read)
                        if (n <= 0) break
                        read += n
                    }
                    if (read == chunk.size) client.send(AudioHeader(newId(), nowMs(), seq++), chunk.copyOf())
                    else if (read == 0) break
                }
            } finally {
                runCatching { record.stop() }
                record.release()
                running.set(false)
            }
        }
    }

    /** Stops capture and closes the utterance. Safe to call when not running (sends nothing then). */
    fun stop() {
        if (!running.getAndSet(false)) return
        worker?.join(200)
        worker = null
        client.send(AudioEnd(newId(), nowMs()))
    }

    private companion object {
        const val RATE = 16_000
        const val CHUNK_BYTES = 640 // 20 ms
    }
}
