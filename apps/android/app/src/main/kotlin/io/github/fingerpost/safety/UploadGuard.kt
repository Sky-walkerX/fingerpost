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

    /** Feed every OCR result (about 5 Hz). Keeps PIN mode state current even when nothing is being uploaded. */
    fun observe(tokens: List<OcrToken>, nowMs: Long) {
        if (PinGate.check(tokens) != PinGateReason.NONE) {
            fewDigitsSince = null
            if (!pinMode) {
                pinMode = true
                onEnter()
            }
            return
        }
        if (!pinMode) return
        if (digitCount(tokens) >= 5) {
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

    /** False blocks the upload. Checks the frame's own tokens too, so the first PIN-pad frame never leaves. */
    fun mayUpload(tokens: List<OcrToken>, nowMs: Long): Boolean {
        observe(tokens, nowMs)
        return !pinMode
    }

    private fun digitCount(tokens: List<OcrToken>) =
        tokens.flatMap { it.text.trim().split(Regex("\\s+")) }.count { it.length == 1 && it[0] in '0'..'9' }

    private companion object { const val EXIT_AFTER_MS = 2_000L }
}
