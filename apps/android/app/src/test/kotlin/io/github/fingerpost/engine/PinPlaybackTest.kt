package io.github.fingerpost.engine

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class PinPlaybackTest {
    private class Output(var routed: Boolean) : PinPcmOutput {
        var writes = 0; var closed = false
        override fun routeVerified() = routed
        override fun write(audio: ByteArray): Boolean { writes++; return true }
        override fun finish() = Unit
        override fun close() { closed = true }
    }
    @Test fun connectedHeadphonesDoNotAuthorizeAnUnverifiedPlaybackRoute() {
        val output = Output(false)
        val gate = PinPlayback { _, _, _, _ -> output }
        val id = gate.newUtterance()
        assertFalse(gate.begin(id, 24000, 2, 1))
        assertFalse(gate.audio(id, byteArrayOf(0, 0)))
        assertEquals(0, output.writes); assertTrue(output.closed)
    }
    @Test fun routeLossStopsTheCurrentOutputAndRejectsLateAudio() {
        val output = Output(true)
        val gate = PinPlayback { _, _, _, _ -> output }
        val id = gate.newUtterance()
        assertTrue(gate.begin(id, 24000, 2, 1)); assertTrue(gate.audio(id, byteArrayOf(0, 0)))
        output.routed = false
        assertFalse(gate.audio(id, byteArrayOf(0, 0)))
        assertTrue(output.closed); assertEquals(1, output.writes)
        assertFalse(gate.audio(id, byteArrayOf(0, 0)))
    }
    @Test fun cancelledAndReplacedSynthesisCannotReopenOrWriteToTheNewOutput() {
        val output = Output(true)
        val gate = PinPlayback { _, _, _, _ -> output }
        val old = gate.newUtterance(); val current = gate.newUtterance()
        assertFalse(gate.begin(old, 24000, 2, 1))
        assertTrue(gate.begin(current, 24000, 2, 1))
        assertFalse(gate.audio(old, byteArrayOf(0, 0)))
        assertEquals(0, output.writes)
        gate.stop(); assertTrue(output.closed)
        assertFalse(gate.begin(current, 24000, 2, 1))
    }
    @Test fun nativeFactoryAndWriteErrorsFailClosed() {
        val gate = PinPlayback { _, _, _, _ -> throw IllegalStateException("synthetic") }
        val id = gate.newUtterance()
        assertFalse(gate.begin(id, 24000, 2, 1))
        assertFalse(gate.audio(id, byteArrayOf(0, 0)))
    }

}
