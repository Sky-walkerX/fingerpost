package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class CameraPitchTest {
    @Test fun uprightAndFlatHoldUseTheDocumentedAxes() {
        assertEquals(0.0, cameraPitchBelowHorizon(0.0, 9.8, 0.0), 0.001)
        assertEquals(90.0, cameraPitchBelowHorizon(0.0, 0.0, 9.8), 0.001)
    }

    @Test fun landscapeRollDoesNotTurnAnUprightScreenIntoAFlatScreen() {
        val portrait = cameraPitchBelowHorizon(0.0, 9.7, 1.0)
        val landscape = cameraPitchBelowHorizon(9.7, 0.0, 1.0)
        assertEquals(portrait, landscape, 0.001)
        assertEquals(Orientation.UPRIGHT, orientationFor(landscape))
    }

    @Test fun diagonalRollKeepsTheSamePitchAndFlatWording() {
        val portrait = cameraPitchBelowHorizon(0.0, 3.0, 8.0)
        val diagonal = cameraPitchBelowHorizon(1.8, -2.4, -8.0)
        assertEquals(portrait, diagonal, 0.001)
        assertEquals(Orientation.FLAT, orientationFor(diagonal))
    }
}
