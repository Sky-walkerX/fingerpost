package io.github.fingerpost.protocol

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
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

fun parseServerMessage(text: String): ServerParse { TODO("D2-T1: implement; the tests describe the behaviour") }

fun encodeClientMessage(msg: ClientMessage): String = TODO("D2-T1: implement; the tests describe the behaviour")

sealed interface DecodedFrame {
    class Ok(val header: JsonObject, val payload: ByteArray) : DecodedFrame
    enum class Error : DecodedFrame { SHORT, HEADER_TOO_LARGE, HEADER_NOT_UTF8, HEADER_NOT_JSON }
}

/** [u32 big-endian headerLen][UTF-8 JSON header][payload] (docs/protocol.md). */
object Frame {
    fun encode(header: ClientMessage, payload: ByteArray): ByteArray { TODO("D2-T1: implement; the tests describe the behaviour") }

    fun decode(buf: ByteArray): DecodedFrame { TODO("D2-T1: implement; the tests describe the behaviour") }
}
