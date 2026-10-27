package io.github.fingerpost.protocol

import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.nio.ByteBuffer

class FrameTest {
    private val header = AudioHeader(id = "a1", ts = 1, seq = 0)

    @Test fun roundTrip() {
        val d = Frame.decode(Frame.encode(header, byteArrayOf(1, 2, 3))) as DecodedFrame.Ok
        assertEquals("audio", d.header["type"]!!.jsonPrimitive.content)
        assertEquals("16000", d.header["sampleRate"]!!.jsonPrimitive.content)
        assertArrayEquals(byteArrayOf(1, 2, 3), d.payload)
    }

    @Test fun headerLengthIsBigEndian() {
        val f = Frame.encode(header, ByteArray(0))
        assertEquals(f.size - 4, ByteBuffer.wrap(f, 0, 4).int)
    }

    @Test fun errors() {
        assertEquals(DecodedFrame.Error.SHORT, Frame.decode(byteArrayOf(0, 0)))
        assertEquals(DecodedFrame.Error.SHORT, Frame.decode(byteArrayOf(0, 0, 0, 10, 123)))
        assertEquals(DecodedFrame.Error.HEADER_TOO_LARGE, Frame.decode(ByteBuffer.allocate(4).putInt(Limits.HEADER_BYTES + 1).array()))
        assertEquals(DecodedFrame.Error.HEADER_NOT_UTF8, Frame.decode(byteArrayOf(0, 0, 0, 2, 0xff.toByte(), 0xfe.toByte())))
        assertEquals(DecodedFrame.Error.HEADER_NOT_JSON, Frame.decode(byteArrayOf(0, 0, 0, 3) + "abc".toByteArray()))
    }

    @Test fun decodesBytesProducedByTheTypeScriptEncoder() {
        // encodeFrame({"a":1}, [9]) from packages/protocol: 00 00 00 07 {"a":1} 09
        val ts = byteArrayOf(0, 0, 0, 7) + """{"a":1}""".toByteArray() + byteArrayOf(9)
        val d = Frame.decode(ts) as DecodedFrame.Ok
        assertArrayEquals(byteArrayOf(9), d.payload)
    }
}
