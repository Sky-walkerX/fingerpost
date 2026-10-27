package io.github.fingerpost.guidance

import kotlin.math.abs
import kotlin.math.hypot

data class Vec2(val x: Double, val y: Double) {
    operator fun plus(o: Vec2) = Vec2(x + o.x, y + o.y)
    operator fun minus(o: Vec2) = Vec2(x - o.x, y - o.y)
    operator fun times(k: Double) = Vec2(x * k, y * k)
    val length: Double get() = hypot(x, y)
}

data class Bbox(val minX: Double, val minY: Double, val maxX: Double, val maxY: Double) {
    val w get() = maxX - minX
    val h get() = maxY - minY
    companion object {
        fun of(pts: List<Vec2>) = Bbox(pts.minOf { it.x }, pts.minOf { it.y }, pts.maxOf { it.x }, pts.maxOf { it.y })
    }
}

/** 3×3 projective transform, row-major, h33 normalized to 1. */
class Homography(private val m: DoubleArray) {
    init { require(m.size == 9) }

    fun map(p: Vec2): Vec2? {
        val w = m[6] * p.x + m[7] * p.y + m[8]
        if (abs(w) < 1e-12) return null
        return Vec2((m[0] * p.x + m[1] * p.y + m[2]) / w, (m[3] * p.x + m[4] * p.y + m[5]) / w)
    }

    companion object {
        val UNIT_SQUARE = listOf(Vec2(0.0, 0.0), Vec2(1.0, 0.0), Vec2(1.0, 1.0), Vec2(0.0, 1.0))

        /** Image quad (TL, TR, BR, BL in image px) → screen-normalized (u, v). */
        fun imageToScreen(quad: List<Vec2>): Homography? = fromPoints(quad, UNIT_SQUARE)

        /** DLT with h33 = 1 from exactly four correspondences. null when the points are degenerate (e.g. 3 collinear). */
        fun fromPoints(src: List<Vec2>, dst: List<Vec2>): Homography? {
            require(src.size == 4 && dst.size == 4)
            val a = Array(8) { DoubleArray(9) }
            for (i in 0 until 4) {
                val (x, y) = src[i]; val (u, v) = dst[i]
                a[2 * i] = doubleArrayOf(x, y, 1.0, 0.0, 0.0, 0.0, -u * x, -u * y, u)
                a[2 * i + 1] = doubleArrayOf(0.0, 0.0, 0.0, x, y, 1.0, -v * x, -v * y, v)
            }
            val h = solve8(a) ?: return null
            return Homography(doubleArrayOf(h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1.0))
        }

        /** Gaussian elimination with partial pivoting on an 8×9 augmented matrix. */
        private fun solve8(a: Array<DoubleArray>): DoubleArray? {
            val n = 8
            for (col in 0 until n) {
                var piv = col
                for (r in col + 1 until n) if (abs(a[r][col]) > abs(a[piv][col])) piv = r
                if (abs(a[piv][col]) < 1e-12) return null
                val t = a[col]; a[col] = a[piv]; a[piv] = t
                for (r in 0 until n) if (r != col) {
                    val f = a[r][col] / a[col][col]
                    for (c in col until n + 1) a[r][c] -= f * a[col][c]
                }
            }
            return DoubleArray(n) { a[it][n] / a[it][it] }
        }
    }
}

/** Ray casting; points exactly on an edge may fall either way, callers use distanceToBoundary for margins. */
fun pointInPolygon(p: Vec2, poly: List<Vec2>): Boolean {
    var inside = false
    var j = poly.size - 1
    for (i in poly.indices) {
        val a = poly[i]; val b = poly[j]
        if ((a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside
        j = i
    }
    return inside
}

fun distanceToSegment(p: Vec2, a: Vec2, b: Vec2): Double {
    val ab = b - a
    val len2 = ab.x * ab.x + ab.y * ab.y
    if (len2 == 0.0) return (p - a).length
    val t = (((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / len2).coerceIn(0.0, 1.0)
    return (p - (a + ab * t)).length
}

fun distanceToBoundary(p: Vec2, poly: List<Vec2>): Double =
    poly.indices.minOf { distanceToSegment(p, poly[it], poly[(it + 1) % poly.size]) }

/** Area centroid (shoelace). Falls back to the vertex mean for zero-area polygons. */
fun areaCentroid(poly: List<Vec2>): Vec2 {
    var a = 0.0; var cx = 0.0; var cy = 0.0
    for (i in poly.indices) {
        val p = poly[i]; val q = poly[(i + 1) % poly.size]
        val cross = p.x * q.y - q.x * p.y
        a += cross; cx += (p.x + q.x) * cross; cy += (p.y + q.y) * cross
    }
    if (abs(a) < 1e-12) return Vec2(poly.sumOf { it.x } / poly.size, poly.sumOf { it.y } / poly.size)
    return Vec2(cx / (3 * a), cy / (3 * a))
}

/**
 * guidance-spec §4 centroid rule: the area centroid if it lies inside, else an approximate pole of
 * inaccessibility (the interior point of a 24×24 grid over the bbox that is farthest from the boundary).
 */
fun targetAnchor(poly: List<Vec2>): Vec2 {
    val c = areaCentroid(poly)
    if (pointInPolygon(c, poly)) return c
    val b = Bbox.of(poly)
    var best = c; var bestD = -1.0
    for (i in 0..24) for (j in 0..24) {
        val p = Vec2(b.minX + b.w * i / 24.0, b.minY + b.h * j / 24.0)
        if (!pointInPolygon(p, poly)) continue
        val d = distanceToBoundary(p, poly)
        if (d > bestD) { bestD = d; best = p }
    }
    return best
}
