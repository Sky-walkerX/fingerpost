package io.github.fingerpost.safety

import io.github.fingerpost.guidance.OcrToken
import io.github.fingerpost.guidance.PinGate
import io.github.fingerpost.guidance.PinGateReason

/**
 * guidance-spec §10.1: every keyframe passes through here before upload. A PIN pad or PIN wording blocks it
 * and enters PIN mode; it exits after 2 s with fewer than 5 digit tokens. Callbacks run on the caller's thread.
 */
class UploadGuard(
    private val onEnter: () -> Unit,
    private val onExit: () -> Unit,
) {
    @Volatile var pinMode = false; private set
    private var fewDigitsSince: Long? = null

    @Synchronized
    fun enterPinMode() {
        fewDigitsSince = null
        if (!pinMode) { pinMode = true; onEnter() }
    }

    /** Serializes the final send with local/server PIN entry, including frames encoded earlier. */
    @Synchronized
    fun sendIfAllowed(send: () -> Boolean): Boolean = !pinMode && send()

    /** Feed every OCR result (about 5 Hz). Keeps PIN mode state current even when nothing is being uploaded. null = OCR failed. */
    @Synchronized
    fun observe(tokens: List<OcrToken>?, nowMs: Long) {
        if (tokens == null) {
            fewDigitsSince = null
            return
        }
        if (PinGate.check(tokens) != PinGateReason.NONE) {
            enterPinMode()
            return
        }
        if (!pinMode) return
        if (PinGate.digitCount(tokens) >= 5) {
            fewDigitsSince = null
            return
        }
        val since = fewDigitsSince ?: nowMs.also { fewDigitsSince = it }
        if (nowMs - since >= EXIT_AFTER_MS) {
            pinMode = false
            fewDigitsSince = null
            onExit()
        }
    }

    /**
     * False blocks the upload. Checks the frame's own tokens, so the first PIN-pad frame never leaves; a frame
     * whose OCR failed (null) is never uploaded either, because it could not be checked.
     */
    @Synchronized
    fun mayUpload(tokens: List<OcrToken>?, nowMs: Long): Boolean {
        observe(tokens, nowMs)
        return tokens != null && !pinMode
    }

    private companion object { const val EXIT_AFTER_MS = 2_000L }
}
