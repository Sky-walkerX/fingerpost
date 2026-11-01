package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

/** Days 4–7 plan, A4-3: keypad layout and the debounced digit under the finger (guidance-spec §10). */
class KeypadTest {
    /** A 3×4 pad from rows of key labels; each digit glyph is 0.04 tall, keys 0.2 apart. */
    private fun pad(vararg rows: String): List<OcrToken> = rows.flatMapIndexed { r, row ->
        row.mapIndexedNotNull { c, ch -> if (ch == ' ') null else OcrToken(ch.toString(), 0.2 + c * 0.2, 0.2 + r * 0.2, 0.03, 0.04) }
    }
    private val phone = pad("123", "456", "789", " 0 ")
    private fun centre(t: OcrToken) = Vec2(t.cx, t.cy)
    private fun key(d: Char) = phone.single { it.text == d.toString() }

    @Test fun phoneLayout() = assertEquals(KeypadLayout.PHONE, classifyKeypad(phone))
    @Test fun calculatorLayout() = assertEquals(KeypadLayout.CALCULATOR, classifyKeypad(pad("789", "456", "123", " 0 ")))
    @Test fun scrambledLayout() = assertEquals(KeypadLayout.SCRAMBLED, classifyKeypad(pad("538", "106", "927", " 4 ")))
    @Test fun noLayoutWithFewerThan7Digits() = assertNull(classifyKeypad(pad("123", "45 ")))
    @Test fun phoneKeyLettersStillCount() = assertEquals(KeypadLayout.PHONE,
        classifyKeypad(phone.map { if (it.text == "2") it.copy(text = "2 ABC") else it }))

    @Test fun digitDebounced150ms() {
        val d = DigitUnderFinger(debounceMs = 150)
        assertNull(d.update(0, centre(key('5')), phone))
        assertNull(d.update(149, centre(key('5')), phone))
        assertEquals('5', d.update(150, centre(key('5')), phone))
        assertNull(d.update(200, centre(key('5')), phone), "no repeat while the finger stays")
        // A brief pass over 6 is not announced; settling on it is.
        assertNull(d.update(300, centre(key('6')), phone))
        assertNull(d.update(350, centre(key('5')), phone))
        assertNull(d.update(400, centre(key('6')), phone))
        assertEquals('6', d.update(550, centre(key('6')), phone))
    }

    @Test fun noDigitWhenBetweenKeys() {
        val d = DigitUnderFinger()
        val between = Vec2((key('5').cx + key('6').cx) / 2, key('5').cy)
        assertNull(d.update(0, between, phone))
        assertNull(d.update(1_000, between, phone))
        assertNull(d.update(2_000, null, phone), "no finger, no digit")
        assertNull(d.update(3_000, centre(key('5')), emptyList()), "no keypad, no digit")
    }
}
