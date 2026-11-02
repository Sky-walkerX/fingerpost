package io.github.fingerpost.guidance

import java.io.File
import java.util.Random
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * Days 4–7 plan, C4-4 (mock-first): local pre-upload PIN gate (guidance-spec §10.1) on the 170 synthetic pinpay
 * sim items, exported by `pnpm --filter @fingerpost/evals export-pin-tokens` (evals/out/pinpay-tokens.json).
 * The release gate is ≥ 98% recall (design §5.6); this measures the local layer on sim items only.
 */
class PinGateDatasetTest {
    private class Item(val id: String, val expectedPin: Boolean, val aspect: Double, val tokens: List<OcrToken>)

    @Suppress("UNCHECKED_CAST")
    private val items: List<Item> by lazy {
        val file = File(System.getProperty("pinpay.tokens") ?: "../../../evals/out/pinpay-tokens.json")
        val root = Json.parse(file.readText()) as Map<String, Any?>
        (root["items"] as List<Map<String, Any?>>).map { m ->
            Item(m["id"] as String, m["expectedPin"] as Boolean, num(m["aspect"]), (m["tokens"] as List<Map<String, Any?>>).map { t ->
                OcrToken(t["text"] as String, num(t["u"]), num(t["v"]), num(t["w"]), num(t["h"]))
            })
        }
    }
    private fun num(v: Any?) = (v as Number).toDouble()

    private fun recall(view: (Item) -> List<OcrToken>): Pair<Int, List<String>> {
        val pads = items.filter { it.expectedPin }
        val missed = pads.filter { PinGate.check(view(it), it.aspect) == PinGateReason.NONE }.map { it.id }
        return pads.size to missed
    }

    @Test fun localGateRecallOnSimPinPadsIsAtLeast98Percent() {
        val (n, missed) = recall { it.tokens }
        assertEquals(120, n)
        val r = (n - missed.size).toDouble() / n
        println("PIN gate local recall (sim): ${n - missed.size}/$n = ${"%.4f".format(r)}")
        assertTrue(r >= 0.98, "local recall $r < 0.98; missed: $missed")
    }

    /** Real terminals don't always print "PIN": the digit-grid rule must carry the gate on its own. */
    @Test fun digitGridAloneRecallIsAtLeast98Percent() {
        val (n, missed) = recall { item -> item.tokens.filter { t -> t.text.any(Char::isDigit) } }
        val r = (n - missed.size).toDouble() / n
        println("PIN gate digit-grid-only recall (sim): ${n - missed.size}/$n = ${"%.4f".format(r)}")
        assertTrue(r >= 0.98, "digit-grid recall $r < 0.98; missed: $missed")
    }

    /** Amount summaries with a Pay button stay online so the price can be confirmed (guidance-spec §10.1). */
    @Test fun amountSummariesAreNotBlocked() {
        val summaries = items.filter { !it.expectedPin }
        val blocked = summaries.filter { PinGate.check(it.tokens, it.aspect) != PinGateReason.NONE }.map { it.id }
        println("PIN gate false blocks on amount summaries (sim): ${blocked.size}/${summaries.size}")
        assertEquals(50, summaries.size)
        assertEquals(emptyList<String>(), blocked)
    }

    /**
     * Typical on-device OCR noise, seeded: one key digit missed, every box jittered by up to 15% of a key's
     * height, and one keypad row read as a single "1 2 3" token. Text stays, as a camera would still see it.
     */
    @Test fun recallHoldsUnderTypicalOcrNoise() {
        val rnd = Random(20261102)
        fun noisy(item: Item): List<OcrToken> {
            val keyH = item.tokens.filter { it.text.length == 1 && it.text[0].isDigit() }.map { it.h }.sorted().let { it[it.size / 2] }
            val jittered = item.tokens.map { t ->
                val d = { (rnd.nextDouble() * 2 - 1) * 0.15 * keyH }
                t.copy(u = (t.u + d()).coerceIn(0.0, 1.0 - t.w), v = (t.v + d()).coerceIn(0.0, 1.0 - t.h))
            }.toMutableList()
            val digits = jittered.filter { it.text.length == 1 && it.text[0].isDigit() }
            jittered.remove(digits[rnd.nextInt(digits.size)])
            val rows = jittered.filter { it.text.length == 1 && it.text[0].isDigit() }.groupBy { (it.cy / keyH).toInt() }.values.filter { it.size == 3 }
            if (rows.isNotEmpty()) {
                val row = rows[rnd.nextInt(rows.size)].sortedBy { it.cx }
                jittered.removeAll(row)
                val u0 = row.minOf { it.u }; val v0 = row.minOf { it.v }
                jittered += OcrToken(row.joinToString(" ") { it.text }, u0, v0, row.maxOf { it.u + it.w } - u0, row.maxOf { it.v + it.h } - v0)
            }
            return jittered
        }
        val (n, missed) = recall(::noisy)
        val r = (n - missed.size).toDouble() / n
        println("PIN gate recall under OCR noise (sim): ${n - missed.size}/$n = ${"%.4f".format(r)}")
        assertTrue(r >= 0.98, "noisy recall $r < 0.98; missed: $missed")
        // Hardest: the same noise and no "PIN" wording at all, so only the digit grid can catch it.
        val (_, gridMissed) = recall { item -> noisy(item).filter { t -> t.text.any(Char::isDigit) } }
        val g = (n - gridMissed.size).toDouble() / n
        println("PIN gate digit-grid-only recall under OCR noise (sim): ${n - gridMissed.size}/$n = ${"%.4f".format(g)}")
        assertTrue(g >= 0.98, "noisy digit-grid recall $g < 0.98; missed: $gridMissed")
    }
}
