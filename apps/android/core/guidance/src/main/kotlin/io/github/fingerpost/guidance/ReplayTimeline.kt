package io.github.fingerpost.guidance

import kotlin.math.floor

data class ReplayTick(val positionUs: Long, val timestampMs: Long)

/** Recorded-media time loops; the monotonic inference clock never rewinds or queues missed frames. */
class ReplayTimeline(private val durationMs: Long, fps: Double, private val now: () -> Long) {
    init { require(durationMs in 1..86_400_000 && fps.isFinite() && fps in 1.0..60.0) }
    private val period = 1000.0 / fps
    private var origin: Long? = null
    private var lastFrame = -1L
    private var lastTimestamp = Long.MIN_VALUE
    fun start() { origin = now(); lastFrame = -1 }
    fun stop() { origin = null }
    fun next(): ReplayTick? {
        val started = origin ?: return null
        val current = now()
        val elapsed = (current - started).coerceAtLeast(0)
        val frame = floor(elapsed / period).toLong()
        if (frame <= lastFrame) return null
        lastFrame = frame
        val timestamp = maxOf(current, if (lastTimestamp == Long.MIN_VALUE) current else lastTimestamp + 1)
        lastTimestamp = timestamp
        return ReplayTick((elapsed % durationMs) * 1000, timestamp)
    }
}
