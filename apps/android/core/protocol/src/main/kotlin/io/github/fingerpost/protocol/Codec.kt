package io.github.fingerpost.protocol

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets

val ProtocolJson: Json = Json {
    classDiscriminator = "type"
    ignoreUnknownKeys = true   // newer servers may add fields
    explicitNulls = false      // omit nulls when encoding optional fields
    encodeDefaults = true      // sampleRate = 16000 must be on the wire
}

/** Server message types this build understands, matching packages/protocol SERVER_TYPES. */
val SERVER_TYPES = setOf("ready", "transcript", "goal.ack", "layout", "target", "say", "ask", "confirm", "expect", "verify", "mode", "quota", "finish", "error", "sim.touch")

sealed interface ServerParse {
    data class Ok(val msg: ServerMessage) : ServerParse
    /** A newer server sent a type this app doesn't know: ignore it. */
    data class Unknown(val type: String) : ServerParse
    data class Invalid(val error: String) : ServerParse
}

fun parseServerMessage(text: String): ServerParse {
    val invalid = ServerParse.Invalid("Invalid server message")
    return try {
        val json = ProtocolJson.parseToJsonElement(text) as? JsonObject ?: return invalid
        val type = (json["type"] as? JsonPrimitive)?.takeIf { it.isString }?.content ?: return invalid
        if (type !in SERVER_TYPES) return ServerParse.Unknown(type)
        if ((json["id"] as? JsonPrimitive)?.isString != true ||
            (json["ts"] as? JsonPrimitive)?.isString != false) return invalid
        val message = ProtocolJson.decodeFromJsonElement(ServerMessage.serializer(), json)
        require(message.id.length in 1..64 && message.ts >= 0)
        ServerParse.Ok(message)
    } catch (_: SerializationException) {
        invalid
    } catch (_: IllegalArgumentException) {
        invalid
    }
}

fun encodeClientMessage(msg: ClientMessage): String {
    require(msg.id.length in 1..64 && msg.ts >= 0)
    return ProtocolJson.encodeToString(ClientMessage.serializer(), msg)
}

sealed interface DecodedFrame {
    class Ok(val header: JsonObject, val payload: ByteArray) : DecodedFrame
    enum class Error : DecodedFrame { SHORT, HEADER_TOO_LARGE, HEADER_NOT_UTF8, HEADER_NOT_JSON }
}

/** [u32 big-endian headerLen][UTF-8 JSON header][payload] (docs/protocol.md). */
object Frame {
    fun encode(header: ClientMessage, payload: ByteArray): ByteArray {
        val bytes = encodeClientMessage(header).toByteArray(StandardCharsets.UTF_8)
        return ByteBuffer.allocate(4 + bytes.size + payload.size)
            .putInt(bytes.size).put(bytes).put(payload).array()
    }

    fun decode(buf: ByteArray): DecodedFrame {
        if (buf.size < 4) return DecodedFrame.Error.SHORT
        val length = Integer.toUnsignedLong(ByteBuffer.wrap(buf, 0, 4).int)
        if (length > Limits.HEADER_BYTES) return DecodedFrame.Error.HEADER_TOO_LARGE
        if (buf.size < 4 + length) return DecodedFrame.Error.SHORT
        val end = 4 + length.toInt()
        val text = try {
            StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(buf, 4, length.toInt())).toString()
        } catch (_: CharacterCodingException) {
            return DecodedFrame.Error.HEADER_NOT_UTF8
        }
        val header = try {
            ProtocolJson.parseToJsonElement(text).jsonObject
        } catch (_: IllegalArgumentException) {
            return DecodedFrame.Error.HEADER_NOT_JSON
        }
        return DecodedFrame.Ok(header, buf.copyOfRange(end, buf.size))
    }
}
