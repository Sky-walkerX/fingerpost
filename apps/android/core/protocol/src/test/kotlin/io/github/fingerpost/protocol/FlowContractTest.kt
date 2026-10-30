package io.github.fingerpost.protocol

import java.io.File
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory

/** Shared scripts are protocol contracts; device state-machine replay is a separate Day 4 task. */
class FlowContractTest {
    private val dir = File(System.getProperty("fixtures.dir"), "flows")

    @TestFactory fun flowMessagesUseExistingKotlinModels(): List<DynamicTest> {
        val files = dir.listFiles()!!.filter { it.extension == "json" }.sortedBy { it.name }
        assertEquals(4, files.size)
        return files.map { file ->
            DynamicTest.dynamicTest(file.name) {
                for (step in Json.parseToJsonElement(file.readText()).jsonObject.getValue("steps").jsonArray) {
                    val fields = step.jsonObject
                    val message = fields.getValue("msg")
                    if (fields.getValue("from").jsonPrimitive.content == "client") {
                        val parsed = ProtocolJson.decodeFromString(ClientMessage.serializer(), message.toString())
                        assertEquals(message.jsonObject.getValue("type"), Json.parseToJsonElement(encodeClientMessage(parsed)).jsonObject.getValue("type"))
                    } else {
                        assertTrue(parseServerMessage(message.toString()) is ServerParse.Ok)
                    }
                }
            }
        }
    }
}
