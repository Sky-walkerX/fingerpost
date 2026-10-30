package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class CapturePolicyTest {
    @Test fun firstLocateProvidesContextThenLaterLocatesStayInsideTheScreen() {
        val policy = CapturePolicy()
        assertEquals(CaptureKind.FULL, policy.kind(true, KeyframePurpose.LOCATE))
        policy.anchored()
        assertEquals(CaptureKind.SCREEN, policy.kind(true, KeyframePurpose.LOCATE))
        assertEquals(CaptureKind.SCREEN, policy.kind(true, KeyframePurpose.VERIFY))
    }

    @Test fun lostQuadCannotBeUsedForRectificationAndNewScreenNeedsAnAnchor() {
        val policy = CapturePolicy()
        policy.anchored()
        assertEquals(CaptureKind.FULL, policy.kind(false, KeyframePurpose.LOCATE))
        policy.reset()
        assertEquals(CaptureKind.FULL, policy.kind(true, KeyframePurpose.LOCATE))
    }

    @Test fun verifyUsesTheKnownQuadEvenBeforeAReplacementServerAnchor() {
        assertEquals(CaptureKind.SCREEN, CapturePolicy().kind(true, KeyframePurpose.VERIFY))
    }
}
