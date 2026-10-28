package io.github.fingerpost.protocol

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.double
import kotlinx.serialization.json.doubleOrNull
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import org.junit.jupiter.api.assertThrows
import java.io.File

class FixtureContractTest {
    private val dir = File(System.getProperty("fixtures.dir") ?: System.getenv("FIXTURES_DIR") ?: error("set -Dfixtures.dir"))
    private fun files(sub: String) = File(dir, sub).listFiles()!!.filter { it.name.endsWith(".json") }.sortedBy { it.name }
    private fun typeOf(name: String) = name.removePrefix("client.").removePrefix("server.").removeSuffix(".json")
    private val plain = Json

    /** JSON numbers compare by value: TypeScript writes 149, Kotlin's Double writes 149.0. */
    private fun norm(e: JsonElement): JsonElement = when (e) {
        is JsonObject -> JsonObject(e.mapValues { norm(it.value) })
        is JsonArray -> JsonArray(e.map { norm(it) })
        is JsonPrimitive -> if (!e.isString && e.doubleOrNull != null && e.booleanOrNull == null) JsonPrimitive(e.double) else e
    }

    @TestFactory fun validServerFixturesParseAndRoundTrip() = files("valid").filter { it.name.startsWith("server.") }.map { f ->
        DynamicTest.dynamicTest(f.name) {
            val parsed = parseServerMessage(f.readText())
            assertTrue(parsed is ServerParse.Ok, "expected Ok, got $parsed")
            val again = ProtocolJson.encodeToJsonElement(ServerMessage.serializer(), (parsed as ServerParse.Ok).msg)
            assertEquals(norm(plain.parseToJsonElement(f.readText())), norm(again))
        }
    }

    @TestFactory fun validClientFixturesDecodeAndReEncodeIdentically() = files("valid").filter { it.name.startsWith("client.") }.map { f ->
        DynamicTest.dynamicTest(f.name) {
            val msg = ProtocolJson.decodeFromString(ClientMessage.serializer(), f.readText())
            assertEquals(norm(plain.parseToJsonElement(f.readText())), norm(plain.parseToJsonElement(encodeClientMessage(msg))))
        }
    }

    @TestFactory fun invalidServerFixturesAreInvalid() = files("invalid").filter { it.name.startsWith("server.") }.map { f ->
        DynamicTest.dynamicTest(f.name) { assertTrue(parseServerMessage(f.readText()) is ServerParse.Invalid) }
    }

    @TestFactory fun invalidClientFixturesThrow() = files("invalid").filter { it.name.startsWith("client.") }.map { f ->
        DynamicTest.dynamicTest(f.name) { assertThrows<Exception> { ProtocolJson.decodeFromString(ClientMessage.serializer(), f.readText()) } }
    }

    @Test fun kotlinKnowsExactlyTheServerTypesThatHaveFixtures() =
        assertEquals(files("valid").filter { it.name.startsWith("server.") }.map { typeOf(it.name) }.toSet(), SERVER_TYPES)

    @Test fun unknownServerTypeIsIgnorable() = assertEquals(ServerParse.Unknown("future.thing"), parseServerMessage("""{"type":"future.thing","id":"x","ts":1}"""))

    @Test fun extraServerFieldsAreIgnored() = assertTrue(parseServerMessage("""{"type":"say","id":"x","ts":1,"text":"Hi","priority":"info","zzz":1}""") is ServerParse.Ok)

    @Test fun garbageIsInvalidNotACrash() {
        for (s in listOf("", "null", "42", "[]", "{", """{"type":5}""")) assertTrue(parseServerMessage(s) is ServerParse.Invalid, s)
    }
}
