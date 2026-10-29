package io.github.fingerpost.guidance

/** docs/protocol.md keyframe limits: at most 400 OCR tokens, text at most 200 chars, boxes inside [0,1]. */
object KeyframeTokens {
    const val MAX_TOKENS = 400
    const val MAX_TEXT = 200

    /** Tokens for a `full` keyframe: the uploaded image has the same aspect as the frame, so boxes carry over. */
    fun forFull(tokens: List<OcrToken>): List<OcrToken> = tokens.mapNotNull { clip(it.text, it.u, it.v, it.u + it.w, it.v + it.h) }.take(MAX_TOKENS)

    /**
     * Tokens for a `screen` (rectified) keyframe. [quad] is TL, TR, BR, BL in the tokens' frame-normalized
     * units. Each box's corners go through the same perspective transform; tokens centred off the screen drop.
     */
    fun forScreen(tokens: List<OcrToken>, quad: List<Vec2>): List<OcrToken> {
        val h = Homography.imageToScreen(quad) ?: return emptyList()
        return tokens.mapNotNull { t ->
            val centre = h.map(Vec2(t.cx, t.cy)) ?: return@mapNotNull null
            if (centre.x !in 0.0..1.0 || centre.y !in 0.0..1.0) return@mapNotNull null
            val corners = listOf(Vec2(t.u, t.v), Vec2(t.u + t.w, t.v), Vec2(t.u + t.w, t.v + t.h), Vec2(t.u, t.v + t.h)).map { h.map(it) ?: return@mapNotNull null }
            clip(t.text, corners.minOf { it.x }, corners.minOf { it.y }, corners.maxOf { it.x }, corners.maxOf { it.y })
        }.take(MAX_TOKENS)
    }

    private fun clip(text: String, x0: Double, y0: Double, x1: Double, y1: Double): OcrToken? {
        val t = text.trim().take(MAX_TEXT)
        val u0 = x0.coerceIn(0.0, 1.0)
        val v0 = y0.coerceIn(0.0, 1.0)
        val u1 = x1.coerceIn(0.0, 1.0)
        val v1 = y1.coerceIn(0.0, 1.0)
        if (t.isEmpty() || u1 <= u0 || v1 <= v0) return null
        return OcrToken(t, u0, v0, u1 - u0, v1 - v0)
    }
}
