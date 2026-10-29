package io.github.fingerpost.vision

import io.github.fingerpost.guidance.Vec2
import kotlin.math.abs
import org.opencv.core.Core
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.MatOfInt
import org.opencv.core.MatOfPoint
import org.opencv.core.MatOfPoint2f
import org.opencv.core.Point
import org.opencv.imgproc.Imgproc

/**
 * guidance-spec §2.0 local screen-quad estimate, run on a 640-wide frame before any upload. Two candidates:
 * the largest convex 4-gon contour, and the min-area rectangle around bright content (plus OCR boxes, Day 3)
 * expanded by 6%. Valid quads cover 8–90% of the frame; the larger wins. Corners are TL, TR, BR, BL.
 */
class QuadEstimator {
    fun estimate(mats: FrameMats, ocrPoints: List<Vec2> = emptyList()): List<Vec2>? {
        val frameArea = mats.gray.width().toDouble() * mats.gray.height()
        val candidates = listOfNotNull(contourQuad(mats.gray, frameArea), contentQuad(mats.value, ocrPoints))
            .filter { quadArea(it) / frameArea in 0.08..0.90 }
        return candidates.maxByOrNull(::quadArea)?.let(::orderCorners)
    }

    private fun contourQuad(gray: Mat, frameArea: Double): List<Vec2>? {
        val edges = Mat()
        Imgproc.Canny(gray, edges, 50.0, 150.0)
        val contours = ArrayList<MatOfPoint>()
        Imgproc.findContours(edges, contours, Mat(), Imgproc.RETR_EXTERNAL, Imgproc.CHAIN_APPROX_SIMPLE)
        edges.release()
        var best: List<Vec2>? = null
        var bestArea = 0.0
        for (contour in contours) {
            val c2f = MatOfPoint2f(*contour.toArray())
            val approx = MatOfPoint2f()
            Imgproc.approxPolyDP(c2f, approx, 0.02 * Imgproc.arcLength(c2f, true), true)
            val pts = approx.toArray()
            if (pts.size == 4 && Imgproc.isContourConvex(MatOfPoint(*pts))) {
                val area = abs(Imgproc.contourArea(approx))
                if (area > bestArea && area / frameArea in 0.08..0.90) {
                    best = pts.map { Vec2(it.x, it.y) }
                    bestArea = area
                }
            }
            c2f.release()
            approx.release()
            contour.release()
        }
        return best
    }

    private fun contentQuad(value: Mat, ocrPoints: List<Vec2>): List<Vec2>? {
        val bright = Mat()
        Imgproc.threshold(value, bright, 0.0, 255.0, Imgproc.THRESH_BINARY or Imgproc.THRESH_OTSU)
        val nonZero = Mat()
        Core.findNonZero(bright, nonZero)
        bright.release()
        val points = ArrayList<Point>()
        if (!nonZero.empty()) {
            val all = MatOfPoint(nonZero)
            val hull = MatOfInt()
            Imgproc.convexHull(all, hull)
            val pts = all.toArray()
            hull.toArray().forEach { points += pts[it] }
            all.release()
            hull.release()
        }
        nonZero.release()
        ocrPoints.forEach { points += Point(it.x, it.y) }
        if (points.size < 3) return null
        val rect = Imgproc.minAreaRect(MatOfPoint2f(*points.toTypedArray()))
        rect.size.width *= 1.06
        rect.size.height *= 1.06
        val corners = arrayOfNulls<Point>(4)
        rect.points(corners)
        return corners.map { Vec2(it!!.x, it.y) }
    }

    companion object {
        fun quadArea(q: List<Vec2>): Double =
            abs(q.indices.sumOf { i -> val a = q[i]; val b = q[(i + 1) % q.size]; a.x * b.y - b.x * a.y }) / 2

        fun orderCorners(q: List<Vec2>): List<Vec2> {
            val byY = q.sortedBy { it.y }
            val top = byY.take(2).sortedBy { it.x }
            val bottom = byY.drop(2).sortedBy { it.x }
            return listOf(top[0], top[1], bottom[1], bottom[0])
        }
    }
}

/** A filled polygon mask (255 inside) the size of [like]. */
internal fun polygonMask(like: Mat, poly: List<Vec2>): Mat {
    val mask = Mat.zeros(like.size(), CvType.CV_8UC1)
    Imgproc.fillPoly(mask, listOf(MatOfPoint(*poly.map { Point(it.x, it.y) }.toTypedArray())), org.opencv.core.Scalar(255.0))
    return mask
}
