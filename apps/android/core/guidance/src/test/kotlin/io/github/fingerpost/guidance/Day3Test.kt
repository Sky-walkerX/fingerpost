package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PinGateTest {
    private fun keypad(order: List<String>, x0: Double = 0.35, y0: Double = 0.2): List<OcrToken> =
        order.mapIndexed { i, d -> OcrToken(d, x0 + (i % 3) * 0.1, y0 + (i / 3) * 0.15, 0.03, 0.06) }

    @Test fun phoneKeypadIsBlocked() = assertEquals(PinGateReason.DIGIT_GRID, PinGate.check(keypad(listOf("1", "2", "3", "4", "5", "6", "7", "8", "9")) + OcrToken("0", 0.45, 0.65, 0.03, 0.06)))
    @Test fun scrambledKeypadIsBlocked() = assertEquals(PinGateReason.DIGIT_GRID, PinGate.check(keypad(listOf("7", "0", "3", "9", "1", "5", "8", "2", "6", "4"))))
    @Test fun pinWordingIsBlockedInThreeLanguages() {
        assertEquals(PinGateReason.PIN_TEXT, PinGate.check(listOf(OcrToken("Enter PIN", 0.4, 0.1, 0.2, 0.05))))
        assertEquals(PinGateReason.PIN_TEXT, PinGate.check(listOf(OcrToken("पिन दर्ज करें", 0.4, 0.1, 0.2, 0.05))))
        assertEquals(PinGateReason.PIN_TEXT, PinGate.check(listOf(OcrToken("Introduzca su clave", 0.4, 0.1, 0.2, 0.05))))
    }
    @Test fun wordsContainingPinAreNotBlocked() = assertEquals(PinGateReason.NONE, PinGate.check(listOf(OcrToken("Spinach", 0.1, 0.1, 0.1, 0.05), OcrToken("Pinball", 0.1, 0.3, 0.1, 0.05))))
    @Test fun sixDigitsAreNotEnough() = assertEquals(PinGateReason.NONE, PinGate.check(keypad(listOf("1", "2", "3", "4", "5", "6"))))
    @Test fun digitsInOneRowAreNotAKeypad() =
        assertEquals(PinGateReason.NONE, PinGate.check((0..9).map { OcrToken("$it", 0.05 + it * 0.09, 0.5, 0.03, 0.06) }))
    @Test fun phoneKeysWithLettersAreBlocked() = assertEquals(PinGateReason.DIGIT_GRID, PinGate.check(
        keypad(listOf("1", "2 ABC", "3 DEF", "4 GHI", "5 JKL", "6 MNO", "7 PQRS", "8 TUV", "9 WXYZ")) + OcrToken("0", 0.45, 0.65, 0.03, 0.06)))
    @Test fun mergedRowTokensAreSplit() = assertEquals(PinGateReason.DIGIT_GRID, PinGate.check(listOf(
        OcrToken("1 2 3", 0.35, 0.2, 0.23, 0.06), OcrToken("4 5 6", 0.35, 0.35, 0.23, 0.06), OcrToken("7 8 9", 0.35, 0.5, 0.23, 0.06), OcrToken("0", 0.45, 0.65, 0.03, 0.06))))
    @Test fun strayDigitsElsewhereDoNotHideAKeypad() = assertEquals(PinGateReason.DIGIT_GRID, PinGate.check(
        keypad(listOf("1", "2", "3", "4", "5", "6", "7", "8", "9")) + OcrToken("0", 0.45, 0.65, 0.03, 0.06) +
            OcrToken("2", 0.05, 0.05, 0.02, 0.04) + OcrToken("5", 0.9, 0.9, 0.02, 0.04)))
    @Test fun passcodeWordingIsBlocked() {
        for (text in listOf("Passcode", "Enter password", "Contraseña", "पासवर्ड")) assertEquals(PinGateReason.PIN_TEXT, PinGate.check(listOf(OcrToken(text, 0.4, 0.1, 0.2, 0.05))), text)
    }
    @Test fun digitCountUsesTheGateParsing() = assertEquals(6, PinGate.digitCount(listOf(OcrToken("1 2 3", 0.1, 0.1, 0.3, 0.05), OcrToken("4GHI", 0.1, 0.2, 0.1, 0.05), OcrToken("5 JKL", 0.2, 0.2, 0.1, 0.05), OcrToken("6", 0.3, 0.2, 0.1, 0.05), OcrToken("149", 0.5, 0.5, 0.1, 0.05))))
    @Test fun clusteringCountsGaps() { assertEquals(3, PinGate.cluster(listOf(0.1, 0.11, 0.5, 0.52, 0.9), 0.05)); assertEquals(0, PinGate.cluster(emptyList(), 0.1)) }
}

class TwoSourceTest {
    private val box = Bbox(0.6, 0.7, 0.9, 0.88)
    @Test fun ocrInsideTheBoxAgrees() = assertTrue(twoSourceAgree("Pay by card", box, listOf(OcrToken("Pay", 0.62, 0.75, 0.08, 0.05), OcrToken("by card", 0.71, 0.75, 0.12, 0.05))))
    @Test fun ocrOutsideTheBoxDoesNotCount() = assertFalse(twoSourceAgree("Start", box, listOf(OcrToken("Start", 0.1, 0.1, 0.1, 0.05))))
    @Test fun disagreeingTextFails() = assertFalse(twoSourceAgree("Start", box, listOf(OcrToken("Stop", 0.7, 0.75, 0.1, 0.05))))
    @Test fun normalizationMatchesTheGateway() { assertEquals("pay by card", normalizeLabel("  ＰＡＹ — by Card! ")); assertEquals(1.0, tokenSetRatio("start", "Start order")) }
}

class ScreenChangeTest {
    private val n = ScreenChangeDetector.W * ScreenChangeDetector.H
    private fun frame(v: Float) = FloatArray(n) { v }
    private val noMask = BooleanArray(n)

    @Test fun firesOnceAfterThreeChangedFrames() {
        val d = ScreenChangeDetector(); d.setReference(frame(0.2f))
        assertFalse(d.update(frame(0.4f), noMask)); assertFalse(d.update(frame(0.4f), noMask))
        assertTrue(d.update(frame(0.4f), noMask)); assertFalse(d.update(frame(0.4f), noMask))
    }
    @Test fun smallChangesAndBrokenRunsDoNotFire() {
        val d = ScreenChangeDetector(); d.setReference(frame(0.2f))
        assertFalse(d.update(frame(0.27f), noMask))
        d.update(frame(0.5f), noMask); d.update(frame(0.5f), noMask); assertFalse(d.update(frame(0.2f), noMask))
        assertFalse(d.update(frame(0.5f), noMask))
    }
    @Test fun handPixelsAreIgnored() {
        val d = ScreenChangeDetector(); d.setReference(frame(0.2f))
        val changedUnderHand = frame(0.2f).also { for (i in 0 until n / 2) it[i] = 1f }
        val mask = BooleanArray(n) { it < n / 2 }
        repeat(5) { assertFalse(d.update(changedUnderHand, mask)) }
    }
    @Test fun noReferenceNeverFires() = assertFalse(ScreenChangeDetector().update(frame(1f), noMask))
}

class FramingTest {
    private val w = 1280; private val h = 720
    private fun rect(x0: Double, y0: Double, x1: Double, y1: Double) = listOf(Vec2(x0, y0), Vec2(x1, y0), Vec2(x1, y1), Vec2(x0, y1))

    @Test fun checksInOrder() {
        val c = FramingCoach()
        assertEquals(FramingCue.NO_SCREEN, c.evaluate(null, w, h))
        assertEquals(FramingCue.CUT_LEFT, c.evaluate(rect(10.0, 100.0, 900.0, 600.0), w, h))
        assertEquals(FramingCue.CUT_BOTTOM, c.evaluate(rect(200.0, 100.0, 900.0, 715.0), w, h))
        assertEquals(FramingCue.MOVE_CLOSER, c.evaluate(rect(560.0, 300.0, 720.0, 420.0), w, h))
        assertEquals(FramingCue.MOVE_BACK, c.evaluate(rect(10.0, 10.0, 1270.0, 710.0), w, h)) // checked before cut-off
        assertEquals(FramingCue.MOVE_RIGHT, c.evaluate(rect(700.0, 150.0, 1200.0, 600.0), w, h))
        assertEquals(FramingCue.GOOD, c.evaluate(rect(300.0, 150.0, 980.0, 570.0), w, h))
    }
    @Test fun spokenCuesAreRateLimitedAndGoodIsSilent() {
        val c = FramingCoach()
        assertEquals(FramingCue.NO_SCREEN, c.cueToSpeak(null, w, h, 0))
        assertNull(c.cueToSpeak(null, w, h, 1000))
        assertEquals(FramingCue.NO_SCREEN, c.cueToSpeak(null, w, h, 1500))
        assertNull(c.cueToSpeak(rect(300.0, 150.0, 980.0, 570.0), w, h, 5000))
    }
    @Test fun quadStabilityNeedsTenStillFrames() {
        val s = QuadStability(); val q = rect(300.0, 150.0, 980.0, 570.0)
        repeat(10) { assertFalse(s.update(q, w, h)) }
        assertTrue(s.update(q, w, h))
        assertFalse(s.update(rect(330.0, 150.0, 1010.0, 570.0), w, h)) // 30 px jump > 1% of the diagonal (14.7 px)
        assertFalse(s.update(null, w, h))
    }
}
