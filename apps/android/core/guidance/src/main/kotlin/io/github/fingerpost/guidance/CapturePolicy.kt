package io.github.fingerpost.guidance

enum class CaptureKind { FULL, SCREEN }

/** A server anchor establishes the screen plane; subsequent uploads use a rectified crop. */
class CapturePolicy {
    @Volatile private var anchored = false
    fun anchored() { anchored = true }
    fun reset() { anchored = false }
    fun kind(hasQuad: Boolean, purpose: KeyframePurpose): CaptureKind =
        if (hasQuad && (anchored || purpose == KeyframePurpose.VERIFY)) CaptureKind.SCREEN else CaptureKind.FULL
}
