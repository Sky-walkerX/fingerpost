package io.github.fingerpost.guidance

import kotlin.math.max
import kotlin.math.min

enum class Zone { ON, EDGE, NEAR, FAR }

/**
 * A target in iso-screen units (x = u · aspect, y = v), guidance-spec §1 and §4.
 * "Inner polygon" is implemented as: inside the polygon AND at least `margin` from its boundary.
 * When even the anchor is closer than `margin` to the boundary (the inner polygon would collapse),
 * ON becomes the disc of radius 0.3 · min(bboxW, bboxH) around the anchor.
 */
class TargetGeometry(polygonUv: List<Vec2>, val aspect: Double) {
    init { require(polygonUv.size >= 3) { "polygon needs ≥ 3 points" }; require(aspect > 0) }

    val poly: List<Vec2> = polygonUv.map { Vec2(it.x * aspect, it.y) }
    val bbox: Bbox = Bbox.of(poly)
    val anchor: Vec2 = targetAnchor(poly)
    val margin: Double = max(0.15 * min(bbox.w, bbox.h), 0.004)
    val useDisc: Boolean = distanceToBoundary(anchor, poly) < margin
    val discRadius: Double = 0.3 * min(bbox.w, bbox.h)
    val nearRadius: Double = 1.5 * max(bbox.w, bbox.h)

    /** Converts screen (u, v) to iso units for this target's aspect. */
    fun toIso(uv: Vec2): Vec2 = Vec2(uv.x * aspect, uv.y)

    fun zone(padIso: Vec2): Zone {
        if (pointInPolygon(padIso, poly)) {
            val insideInner = if (useDisc) (padIso - anchor).length <= discRadius
                else distanceToBoundary(padIso, poly) >= margin
            return if (insideInner) Zone.ON else Zone.EDGE
        }
        return if ((padIso - anchor).length <= nearRadius) Zone.NEAR else Zone.FAR
    }

    /** e = c − pad (guidance-spec §5), iso units. */
    fun error(padIso: Vec2): Vec2 = anchor - padIso
}

/** guidance-spec §4: ON for 6 consecutive frames to enter, 3 consecutive non-ON frames to leave. */
class OnTargetDebouncer(private val enterFrames: Int = 6, private val leaveFrames: Int = 3) {
    var onTarget = false; private set
    private var onRun = 0
    private var offRun = 0

    /** Returns true exactly when the on-target state changes. */
    fun update(zone: Zone): Boolean {
        val wasOnTarget = onTarget
        if (zone == Zone.ON) {
            offRun = 0
            onRun = (onRun + 1).coerceAtMost(enterFrames)
            if (onRun >= enterFrames) onTarget = true
        } else {
            onRun = 0
            offRun = (offRun + 1).coerceAtMost(leaveFrames)
            if (offRun >= leaveFrames) onTarget = false
        }
        return onTarget != wasOnTarget
    }

    fun reset() {
        onTarget = false
        onRun = 0
        offRun = 0
    }
}
