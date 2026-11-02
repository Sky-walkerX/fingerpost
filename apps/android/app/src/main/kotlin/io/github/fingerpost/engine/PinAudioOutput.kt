package io.github.fingerpost.engine

import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioRouting
import android.media.AudioTrack
import android.os.Build
import android.os.Handler
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** TTS never plays PIN speech itself. Only this track can emit its PCM, after an actual route check. */
internal class PinAudioOutput private constructor(
    private val track: AudioTrack,
    private val device: AudioDeviceInfo,
    private val handler: Handler,
    private val frameBytes: Int,
    private val chunkBytes: Int,
    private val onLost: () -> Unit,
) : PinPcmOutput {
    @Volatile private var closed = false
    private var writtenFrames = 0
    private val routed = CountDownLatch(1)
    private val routing = AudioRouting.OnRoutingChangedListener {
        routed.countDown()
        if (!routeVerified()) {
            close()
            onLost()
        }
    }

    override fun routeVerified(): Boolean = runCatching {
        if (closed) return false
        val devices = if (Build.VERSION.SDK_INT >= 36) track.routedDevices else listOfNotNull(track.routedDevice)
        devices.isNotEmpty() && devices.all { it.id == device.id && it.type in EARPHONES }
    }.getOrDefault(false)

    private fun prepare(): Boolean {
        track.setVolume(0f)
        track.addOnRoutingChangedListener(routing, handler)
        if (!track.setPreferredDevice(device)) return false
        // Silence establishes an active route; connected/preferred devices alone authorize nothing.
        val silence = ByteArray(chunkBytes)
        if (track.write(silence, 0, silence.size, AudioTrack.WRITE_NON_BLOCKING) != silence.size) return false
        writtenFrames += silence.size / frameBytes
        track.play()
        if (!routeVerified()) routed.await(500, TimeUnit.MILLISECONDS)
        if (!routeVerified()) return false
        track.setVolume(1f)
        return true
    }

    override fun write(audio: ByteArray): Boolean {
        if (audio.size % frameBytes != 0) return false
        var offset = 0
        while (offset < audio.size) {
            if (!routeVerified()) return false
            val length = minOf(chunkBytes, audio.size - offset)
            val written = runCatching { track.write(audio, offset, length, AudioTrack.WRITE_BLOCKING) }.getOrDefault(-1)
            if (written <= 0 || written % frameBytes != 0) return false
            writtenFrames += written / frameBytes
            offset += written
        }
        return routeVerified()
    }

    @Synchronized override fun finish() {
        if (closed) return
        track.setPlaybackPositionUpdateListener(object : AudioTrack.OnPlaybackPositionUpdateListener {
            override fun onPeriodicNotification(track: AudioTrack) = Unit
            override fun onMarkerReached(track: AudioTrack) { close() }
        }, handler)
        track.notificationMarkerPosition = writtenFrames
        if (track.playbackHeadPosition >= writtenFrames) close()
    }

    @Synchronized override fun close() {
        if (closed) return
        closed = true
        routed.countDown()
        runCatching { track.setVolume(0f); track.pause(); track.flush() }
        runCatching { track.removeOnRoutingChangedListener(routing) }
        track.release()
    }

    companion object {
        val EARPHONES = setOf(AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_USB_HEADSET, AudioDeviceInfo.TYPE_BLE_HEADSET)

        fun create(device: AudioDeviceInfo, handler: Handler, rate: Int, encoding: Int, channels: Int,
            onLost: () -> Unit): PinPcmOutput? {
            if (device.type !in EARPHONES || encoding != AudioFormat.ENCODING_PCM_16BIT || channels !in 1..2 || rate <= 0) return null
            val mask = if (channels == 1) AudioFormat.CHANNEL_OUT_MONO else AudioFormat.CHANNEL_OUT_STEREO
            val minimum = AudioTrack.getMinBufferSize(rate, mask, encoding)
            if (minimum <= 0) return null
            val frameBytes = 2 * channels
            val chunk = maxOf(1, rate / 200) * frameBytes
            val track = AudioTrack.Builder()
                .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                .setAudioFormat(AudioFormat.Builder().setSampleRate(rate).setEncoding(encoding).setChannelMask(mask).build())
                .setBufferSizeInBytes(maxOf(minimum, chunk)).setTransferMode(AudioTrack.MODE_STREAM).build()
            val output = PinAudioOutput(track, device, handler, frameBytes, chunk, onLost)
            return try { if (output.prepare()) output else { output.close(); null } }
            catch (_: Exception) { output.close(); null }
        }
    }
}
