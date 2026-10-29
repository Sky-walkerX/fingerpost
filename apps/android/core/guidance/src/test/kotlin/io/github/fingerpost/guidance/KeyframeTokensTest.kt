package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class KeyframeTokensTest {
    private val quad = listOf(Vec2(0.2, 0.1), Vec2(0.8, 0.1), Vec2(0.8, 0.9), Vec2(0.2, 0.9))

    @Test fun screenTokensAreRenormalizedToTheRectifiedScreen() {
        val t = KeyframeTokens.forScreen(listOf(OcrToken("Start", 0.5, 0.5, 0.06, 0.08)), quad).single()
        assertEquals(0.5, t.u, 1e-9); assertEquals(0.5, t.v, 1e-9)
        assertEquals(0.1, t.w, 1e-9); assertEquals(0.1, t.h, 1e-9)
    }
    @Test fun tokensCentredOffTheScreenAreDropped() =
        assertTrue(KeyframeTokens.forScreen(listOf(OcrToken("Logo", 0.05, 0.05, 0.05, 0.03)), quad).isEmpty())
    @Test fun boxesAreClippedTextTrimmedAndCountCapped() {
        val many = List(450) { OcrToken("  ${"x".repeat(250)} ", 0.95, 0.5, 0.1, 0.05) }
        val out = KeyframeTokens.forFull(many)
        assertEquals(400, out.size)
        assertEquals(200, out[0].text.length)
        assertEquals(1.0, out[0].u + out[0].w, 1e-9)
    }
}
