package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class GeometryTest {
    private fun assertVec(e: Vec2, a: Vec2?, tol: Double = 1e-9) { assertEquals(e.x, a!!.x, tol); assertEquals(e.y, a.y, tol) }

    @Test fun axisAlignedQuadMapsCornersAndCentre() {
        val h = Homography.imageToScreen(listOf(Vec2(100.0, 50.0), Vec2(500.0, 50.0), Vec2(500.0, 350.0), Vec2(100.0, 350.0)))!!
        assertVec(Vec2(0.0, 0.0), h.map(Vec2(100.0, 50.0)))
        assertVec(Vec2(1.0, 1.0), h.map(Vec2(500.0, 350.0)))
        assertVec(Vec2(0.5, 0.5), h.map(Vec2(300.0, 200.0)))
    }

    @Test fun perspectiveQuadMapsAllFourCornersExactly() {
        val quad = listOf(Vec2(212.0, 140.0), Vec2(1060.0, 152.0), Vec2(1048.0, 610.0), Vec2(220.0, 598.0))
        val h = Homography.imageToScreen(quad)!!
        Homography.UNIT_SQUARE.forEachIndexed { i, uv -> assertVec(uv, h.map(quad[i]), 1e-7) }
    }

    @Test fun perspectiveMapsTheDiagonalIntersectionToTheCentre() {
        // In a projective map, the intersection of the quad's diagonals maps to (0.5, 0.5).
        val q = listOf(Vec2(0.0, 0.0), Vec2(400.0, 40.0), Vec2(360.0, 300.0), Vec2(20.0, 260.0))
        val h = Homography.imageToScreen(q)!!
        fun intersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 {
            val r = b - a; val s = d - c
            val t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / (r.x * s.y - r.y * s.x)
            return a + r * t
        }
        assertVec(Vec2(0.5, 0.5), h.map(intersect(q[0], q[2], q[1], q[3])), 1e-7)
    }

    @Test fun degenerateQuadReturnsNull() {
        assertNull(Homography.imageToScreen(listOf(Vec2(0.0, 0.0), Vec2(10.0, 0.0), Vec2(20.0, 0.0), Vec2(5.0, 9.0))))
    }

    private val square = listOf(Vec2(0.0, 0.0), Vec2(1.0, 0.0), Vec2(1.0, 1.0), Vec2(0.0, 1.0))
    private val lShape = listOf(Vec2(0.0, 0.0), Vec2(0.2, 0.0), Vec2(0.2, 0.8), Vec2(1.0, 0.8), Vec2(1.0, 1.0), Vec2(0.0, 1.0))

    @Test fun pointInPolygonBasics() {
        assertTrue(pointInPolygon(Vec2(0.5, 0.5), square))
        assertFalse(pointInPolygon(Vec2(1.5, 0.5), square))
        assertFalse(pointInPolygon(Vec2(0.6, 0.4), lShape))
        assertTrue(pointInPolygon(Vec2(0.1, 0.5), lShape))
    }

    @Test fun distanceToBoundaryOfSquareCentreIsHalf() = assertEquals(0.5, distanceToBoundary(Vec2(0.5, 0.5), square), 1e-12)

    @Test fun anchorOfConvexShapeIsTheCentroid() = assertVec(Vec2(0.5, 0.5), targetAnchor(square))

    @Test fun anchorOfLShapeIsInsideEvenThoughTheCentroidIsNot() {
        assertFalse(pointInPolygon(areaCentroid(lShape), lShape))
        assertTrue(pointInPolygon(targetAnchor(lShape), lShape))
    }
}
