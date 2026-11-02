package io.github.fingerpost.engine

internal interface PinPcmOutput {
    fun routeVerified(): Boolean
    fun write(audio: ByteArray): Boolean
    fun finish()
    fun close()
}

/** A cancelled synthesis callback cannot authorize playback or touch its replacement. No content is retained. */
internal class PinPlayback(private val create: (String, Int, Int, Int) -> PinPcmOutput?) {
    private var generation = 0L
    private var current: String? = null
    private var output: PinPcmOutput? = null
    private var rejected = false

    @Synchronized fun newUtterance(): String {
        stop()
        return "pin-${++generation}".also { current = it }
    }

    @Synchronized fun begin(id: String, sampleRate: Int, encoding: Int, channels: Int): Boolean {
        if (id != current || rejected) return false
        output?.close()
        output = runCatching { create(id, sampleRate, encoding, channels) }.getOrNull()
        if (!runCatching { output?.routeVerified() == true }.getOrDefault(false)) { reject(); return false }
        return true
    }

    @Synchronized fun audio(id: String, bytes: ByteArray): Boolean {
        if (id != current || rejected) return false
        val sink = output ?: return false
        if (!runCatching { sink.routeVerified() && sink.write(bytes) }.getOrDefault(false)) { reject(); return false }
        return true
    }

    @Synchronized fun finish(id: String) { if (id == current) output?.finish() }
    @Synchronized fun isCurrent(id: String): Boolean = id == current
    private fun reject() { rejected = true; output?.close(); output = null }
    @Synchronized fun stop() { current = null; rejected = false; output?.close(); output = null }
}
