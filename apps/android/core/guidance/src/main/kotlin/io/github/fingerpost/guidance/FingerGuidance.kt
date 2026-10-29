package io.github.fingerpost.guidance

data class GuidedFinger(val uv: Vec2, val error: Vec2, val zone: Zone)

/** Keeps filtering and hand selection independent of Android and counts each landmark result once. */
class FingerGuidance {
    var target: TargetGeometry? = null; private set
    private val u = OneEuroFilter()
    private val v = OneEuroFilter()
    private var lastSample = Long.MIN_VALUE

    fun setTarget(polygon: List<Vec2>, aspect: Double) {
        target = TargetGeometry(polygon, aspect)
        resetFilters()
    }

    fun clear() {
        target = null
        resetFilters()
    }

    private fun resetFilters() { u.reset(); v.reset(); lastSample = Long.MIN_VALUE }

    fun update(sampleMs: Long, frameW: Int, frameH: Int, hands: List<HandSample>, quad: List<Vec2>?): GuidedFinger? {
        if (sampleMs <= lastSample) return null
        lastSample = sampleMs
        val geometry = target ?: return null
        val h = quad?.let(Homography::imageToScreen) ?: return null
        val screenToImage = Homography.fromPoints(Homography.UNIT_SQUARE, quad) ?: return null
        val anchor = screenToImage.map(Vec2(geometry.anchor.x / geometry.aspect, geometry.anchor.y))
        val hand = chooseHand(hands, frameW, frameH, anchor)
        if (hand == null) { u.reset(); v.reset(); return null }
        val raw = h.map(padPoint(hand.tip, hand.dip)) ?: return null
        if (!raw.x.isFinite() || !raw.y.isFinite() || isOffScreen(raw)) { u.reset(); v.reset(); return null }
        val uv = Vec2(u.filter(raw.x, sampleMs / 1000.0), v.filter(raw.y, sampleMs / 1000.0))
        val iso = geometry.toIso(uv)
        return GuidedFinger(uv, geometry.error(iso), geometry.zone(iso))
    }
}
