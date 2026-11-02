package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

/** Days 4–7 plan, A5-2: a cached layout guides at once only when fresh OCR agrees on the target label. */
class CacheRelockTest {
    private fun box(u: Double, v: Double) = listOf(Vec2(u, v), Vec2(u + 0.2, v), Vec2(u + 0.2, v + 0.1), Vec2(u, v + 0.1))
    private val drinks = CachedElement("drinks", "Drinks", "button", box(0.4, 0.3))
    private val layout = CachedLayout(listOf(
        CachedElement("burgers", "Burgers", "button", box(0.1, 0.3)), drinks,
        CachedElement("pay", "Pay by card", "pay", box(0.7, 0.8)),
        CachedElement("wifi", "Wi-Fi", "icon", box(0.0, 0.0)),
        CachedElement("total", "Total", "text", box(0.1, 0.8)),
    ))
    private val ocr = listOf(OcrToken("Burgers", 0.12, 0.31, 0.15, 0.05), OcrToken("Drinks", 0.42, 0.31, 0.15, 0.05))

    @Test fun hitWhenOcrAgreesOnTheLabel() {
        assertEquals(CacheRelock.Guide(drinks, "Found Drinks, middle."), CacheRelock.decide("press drinks", layout, ocr, Strings.EN))
    }

    @Test fun ocrDisagreementDropsTheEntry() {
        val moved = listOf(OcrToken("Sides", 0.42, 0.31, 0.15, 0.05))
        assertEquals(CacheRelock.Drop, CacheRelock.decide("drinks", layout, moved, Strings.EN))
    }

    @Test fun payConfirmSubmitAndIconsAlwaysWaitForTheGateway() {
        assertEquals(CacheRelock.Server, CacheRelock.decide("pay by card", layout, ocr, Strings.EN))
        assertEquals(CacheRelock.Server, CacheRelock.decide("wifi", layout, ocr, Strings.EN))
    }

    @Test fun textElementsAndUnknownGoalsGoToTheGateway() {
        assertEquals(CacheRelock.Server, CacheRelock.decide("total", layout, ocr, Strings.EN))
        assertEquals(CacheRelock.Server, CacheRelock.decide("help", layout, ocr, Strings.EN))
    }
}
