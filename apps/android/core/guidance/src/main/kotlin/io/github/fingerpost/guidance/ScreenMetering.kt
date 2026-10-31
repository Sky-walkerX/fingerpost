package io.github.fingerpost.guidance

class ScreenMetering {
    private var lastAt: Long? = null

    fun update(quad: List<Vec2>?, stable: Boolean, nowMs: Long): Vec2? {
        if (!stable || quad == null || quad.size != 4 || quad.any { it.x !in 0.0..1.0 || it.y !in 0.0..1.0 }) {
            lastAt = null
            return null
        }
        if (lastAt?.let { nowMs - it < REFRESH_MS } == true) return null
        lastAt = nowMs
        return Vec2(quad.sumOf { it.x } / 4, quad.sumOf { it.y } / 4)
    }

    companion object { const val REFRESH_MS = 5_000L }
}
