package io.github.fingerpost.safety

import io.github.fingerpost.guidance.OcrToken
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class UploadGuardTest {
    @Test fun failedOcrBlocksTheFrame() {
        val gate = UploadGuard({}, {})
        assertFalse(gate.mayUpload(null, 0))
        assertTrue(gate.mayUpload(emptyList(), 1))
    }

    @Test fun firstPinFrameBlocksBeforeCallbackAndEntersOnlyOnce() {
        var entries = 0
        val gate = UploadGuard({ entries++ }, {})
        val pin = listOf(OcrToken("PIN", 0.1, 0.1, 0.1, 0.1))
        assertFalse(gate.mayUpload(pin, 0))
        assertFalse(gate.mayUpload(pin, 500))
        assertEquals(1, entries)
    }

    @Test fun failedOcrBreaksTheContinuousExitWindow() {
        var exits = 0
        val gate = UploadGuard({}, { exits++ })
        gate.observe(listOf(OcrToken("PIN", 0.1, 0.1, 0.1, 0.1)), 0)
        gate.observe(emptyList(), 100)
        gate.observe(null, 1900)
        assertFalse(gate.mayUpload(emptyList(), 2100))
        assertFalse(gate.mayUpload(emptyList(), 4099))
        assertTrue(gate.mayUpload(emptyList(), 4100))
        assertEquals(1, exits)
    }

    @Test fun labeledAndMergedDigitsPreventExit() {
        val gate = UploadGuard({}, {})
        gate.observe(listOf(OcrToken("PIN", 0.1, 0.1, 0.1, 0.1)), 0)
        gate.observe(emptyList(), 100)
        gate.observe(listOf(OcrToken("1 2 3", 0.1, 0.1, 0.3, 0.1),
            OcrToken("4GHI", 0.1, 0.3, 0.1, 0.1), OcrToken("5 JKL", 0.3, 0.3, 0.1, 0.1)), 1900)
        assertFalse(gate.mayUpload(emptyList(), 2100))
    }
}
