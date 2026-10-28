package io.github.fingerpost.protocol

import java.nio.ByteBuffer
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class CodecBoundaryTest {
    @Test fun unsignedHeaderLengthsAreRejectedBeforeCheckingForMissingBytes() {
        for (length in listOf(Int.MIN_VALUE, -1)) {
            assertEquals(DecodedFrame.Error.HEADER_TOO_LARGE,
                Frame.decode(ByteBuffer.allocate(4).putInt(length).array()))
        }
    }

    @Test fun unicodeHeaderLengthCountsBytesAndPayloadIsUnchanged() {
        val payload = byteArrayOf(0, 127, -1, 0)
        val header = Goal("synthetic", 1, "synthetic Ω", GoalSource.TYPED)
        val encoded = Frame.encode(header, payload)
        val jsonBytes = encodeClientMessage(header).toByteArray(Charsets.UTF_8)
        assertEquals(jsonBytes.size, ByteBuffer.wrap(encoded).int)
        val decoded = Frame.decode(encoded) as DecodedFrame.Ok
        assertArrayEquals(payload, decoded.payload)
    }

    @Test fun overlongAndIncompleteUtf8IsRejected() {
        for (header in listOf(byteArrayOf(0xc0.toByte(), 0xaf.toByte()), byteArrayOf(0xe2.toByte(), 0x82.toByte()))) {
            val frame = ByteBuffer.allocate(4 + header.size).putInt(header.size).put(header).array()
            assertEquals(DecodedFrame.Error.HEADER_NOT_UTF8, Frame.decode(frame))
        }
    }

    @Test fun serverTypeMustBeAString() {
        for (type in listOf("null", "true", "5", "[]", "{}")) {
            assertTrue(parseServerMessage("{\"type\":$type}") is ServerParse.Invalid)
        }
    }

    @Test fun invalidServerErrorsDoNotEchoMessageContents() {
        val parsed = parseServerMessage("""{"type":"say","id":"x","ts":1,"text":["synthetic-sensitive"],"priority":"info"}""")
        assertTrue(parsed is ServerParse.Invalid)
        assertFalse((parsed as ServerParse.Invalid).error.contains("synthetic-sensitive"))
    }

    @Test fun invalidCommonClientFieldsCannotBeEncoded() {
        for (message in listOf(AudioEnd("", 1), AudioEnd("x".repeat(65), 1), AudioEnd("x", -1))) {
            assertThrows<IllegalArgumentException> { encodeClientMessage(message) }
        }
    }
}
