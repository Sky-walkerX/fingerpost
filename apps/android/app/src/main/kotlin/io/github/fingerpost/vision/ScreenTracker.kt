package io.github.fingerpost.vision

import io.github.fingerpost.guidance.Bbox
import io.github.fingerpost.guidance.Homography
import io.github.fingerpost.guidance.Vec2
import org.opencv.calib3d.Calib3d
import org.opencv.core.Core
import org.opencv.core.Mat
import org.opencv.core.MatOfByte
import org.opencv.core.MatOfFloat
import org.opencv.core.MatOfPoint
import org.opencv.core.MatOfPoint2f
import org.opencv.core.Point
import org.opencv.core.Rect
import org.opencv.core.Scalar
import org.opencv.core.Size
import org.opencv.imgproc.Imgproc
import org.opencv.video.Video

enum class TrackState { NONE, ACQUIRING, TRACKING, DEGRADED, LOST }

/**
 * guidance-spec §2: KLT features inside the screen quad (hand excluded), RANSAC homography frame to frame,
 * quad corners carried through it. Coordinates are the tracker's own frame (the 640-wide gray image).
 */
class ScreenTracker {
    var quad: List<Vec2>? = null; private set
    var state = TrackState.NONE; private set
    var imageToScreen: Homography? = null; private set

    private var prev: Mat? = null
    private var prevPts: MatOfPoint2f? = null
    private var badFrames = 0
    private var degradedSince = 0L

    /** Replaces the quad (local estimate or server `layout.screenQuad`); features are re-detected next frame. */
    fun reanchor(newQuad: List<Vec2>) {
        quad = newQuad
        imageToScreen = null
        // A stable contour or server anchor proposes geometry; only inlier-backed motion validates tracking.
        state = TrackState.ACQUIRING
        badFrames = 0
        prevPts?.release()
        prevPts = null
    }

    fun reset() {
        quad = null
        imageToScreen = null
        state = TrackState.NONE
        prev?.release()
        prev = null
        prevPts?.release()
        prevPts = null
        badFrames = 0
    }

    /** [handBox] in the same pixel frame; it is dilated by 15% and excluded from features. */
    fun update(gray: Mat, handBox: Bbox?, nowMs: Long): TrackState {
        val current = quad ?: return TrackState.NONE.also { state = it }
        val previous = prev
        val points = prevPts
        if (previous != null && points != null && !points.empty()) track(previous, points, gray, current, handBox, nowMs)
        else if (previous != null) badFrame(nowMs)
        if (quad != null && (prevPts == null || prevPts!!.rows() < MIN_FEATURES)) detect(gray, quad!!, handBox)
        prev?.release()
        prev = gray.clone()
        return state
    }

    private fun track(previous: Mat, points: MatOfPoint2f, gray: Mat, current: List<Vec2>, handBox: Bbox?, nowMs: Long) {
        val next = MatOfPoint2f()
        val status = MatOfByte()
        val err = MatOfFloat()
        Video.calcOpticalFlowPyrLK(previous, gray, points, next, status, err, Size(21.0, 21.0), 3)
        val st = status.toArray()
        val a = points.toArray()
        val b = next.toArray()
        val from = ArrayList<Point>()
        val to = ArrayList<Point>()
        for (i in st.indices) if (st[i].toInt() == 1) {
            val handCovers = handBox?.let { box ->
                val dx = box.w * 0.15 / 2
                val dy = box.h * 0.15 / 2
                b[i].x in (box.minX - dx)..(box.maxX + dx) && b[i].y in (box.minY - dy)..(box.maxY + dy)
            } ?: false
            if (!handCovers) { from += a[i]; to += b[i] }
        }
        next.release(); status.release(); err.release()

        var inlierTo: List<Point> = emptyList()
        if (from.size >= MIN_INLIERS) {
            val src = MatOfPoint2f(*from.toTypedArray())
            val dst = MatOfPoint2f(*to.toTypedArray())
            val mask = Mat()
            val h = Calib3d.findHomography(src, dst, Calib3d.RANSAC, 3.0, mask)
            if (!h.empty()) {
                val inliers = ArrayList<Point>()
                for (i in to.indices) if (mask.get(i, 0)[0] != 0.0) inliers += to[i]
                if (inliers.size >= MIN_INLIERS) {
                    val corners = MatOfPoint2f(*current.map { Point(it.x, it.y) }.toTypedArray())
                    val moved = MatOfPoint2f()
                    Core.perspectiveTransform(corners, moved, h)
                    val candidate = moved.toArray().map { Vec2(it.x, it.y) }
                    val size = minOf((current[1] - current[0]).length, (current[3] - current[0]).length)
                    val valid = candidate.all { it.x.isFinite() && it.y.isFinite() } &&
                        candidate.indices.all { (candidate[it] - current[it]).length < size * 0.25 }
                    val transform = if (valid) Homography.imageToScreen(candidate) else null
                    if (transform != null) { quad = candidate; imageToScreen = transform; inlierTo = inliers }
                    corners.release(); moved.release()
                }
            }
            src.release(); dst.release(); mask.release(); h.release()
        }

        prevPts?.release()
        if (inlierTo.isNotEmpty()) {
            prevPts = MatOfPoint2f(*inlierTo.toTypedArray())
            badFrames = 0
            state = TrackState.TRACKING
        } else {
            prevPts = if (to.isEmpty()) null else MatOfPoint2f(*to.toTypedArray())
            badFrame(nowMs)
        }
    }

    private fun badFrame(nowMs: Long) {
        badFrames++
        if ((state == TrackState.ACQUIRING || state == TrackState.TRACKING) && badFrames >= DEGRADE_AFTER_FRAMES) {
            state = TrackState.DEGRADED
            degradedSince = nowMs
        } else if (state == TrackState.DEGRADED && nowMs - degradedSince >= LOST_AFTER_MS) state = TrackState.LOST
    }

    private fun detect(gray: Mat, q: List<Vec2>, handBox: Bbox?) {
        val mask = polygonMask(gray, q)
        if (handBox != null) {
            val dx = handBox.w * 0.15 / 2
            val dy = handBox.h * 0.15 / 2
            Imgproc.rectangle(mask, Rect(Point(handBox.minX - dx, handBox.minY - dy), Point(handBox.maxX + dx, handBox.maxY + dy)),
                Scalar(0.0), -1)
        }
        val corners = MatOfPoint()
        Imgproc.goodFeaturesToTrack(gray, corners, 200, 0.01, 8.0, mask)
        mask.release()
        prevPts?.release()
        prevPts = if (corners.empty()) null else MatOfPoint2f(*corners.toArray())
        corners.release()
    }

    companion object {
        const val MIN_FEATURES = 40
        const val MIN_INLIERS = 12
        const val DEGRADE_AFTER_FRAMES = 5
        const val LOST_AFTER_MS = 1000L
    }
}
