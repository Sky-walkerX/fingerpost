package io.github.fingerpost.protocol

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class AskReasonTest {
    @Test fun reframeReasonDecodesAndOlderAsksHaveNone() {
        val reframe = parseServerMessage("""{"type":"ask","id":"synthetic","ts":1,"question":"I can't find the screen.","options":[],"reason":"reframe"}""") as ServerParse.Ok
        assertEquals(AskReason.REFRAME, (reframe.msg as Ask).reason)
        val plain = parseServerMessage("""{"type":"ask","id":"synthetic","ts":1,"question":"Which size?","options":["small"]}""") as ServerParse.Ok
        assertNull((plain.msg as Ask).reason)
    }
}
