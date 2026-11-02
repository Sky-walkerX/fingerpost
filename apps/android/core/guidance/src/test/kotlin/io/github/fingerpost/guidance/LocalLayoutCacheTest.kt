package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.util.Random

/** Days 4–7 plan, A5-2: on-device layout cache for instant re-lock (guidance-spec §11c). */
class LocalLayoutCacheTest {
    private fun t(text: String, u: Double = 0.1, v: Double = 0.1) = OcrToken(text, u, v, 0.2, 0.1)
    private fun box(u: Double, v: Double) = listOf(Vec2(u, v), Vec2(u + 0.2, v), Vec2(u + 0.2, v + 0.1), Vec2(u, v + 0.1))
    private val menu = CachedLayout(listOf(
        CachedElement("burgers", "Burgers", "button", box(0.1, 0.3)),
        CachedElement("drinks", "Drinks", "button", box(0.4, 0.3)),
        CachedElement("cart", "View cart", "button", box(0.7, 0.8)),
    ))
    private val menuTokens = listOf(t("Burgers"), t("Drinks"), t("Sides"), t("Desserts"), t("View cart"), t("Total ₹149"), t("Order 42"), t("Welcome to Quick Bite"))

    @Test fun priceChangeStillHits() {
        val cache = LocalLayoutCache(InMemoryLayoutStore())
        cache.put(cache.key(menuTokens, 1.6), menu)
        val later = menuTokens.map { if (it.text == "Total ₹149") t("Total ₹189") else if (it.text == "Order 42") t("Order 57") else it }
        assertEquals(menu, cache.get(cache.key(later, 1.6)))
    }

    @Test fun oneWordOfNoiseStillHits() {
        val cache = LocalLayoutCache(InMemoryLayoutStore())
        cache.put(cache.key(menuTokens, 1.6), menu)
        val ocrNoise = menuTokens.map { if (it.text == "Desserts") t("Dessert") else it }
        assertNotNull(cache.get(cache.key(ocrNoise, 1.6)))
    }

    @Test fun differentScreenMisses() {
        val cache = LocalLayoutCache(InMemoryLayoutStore())
        cache.put(cache.key(menuTokens, 1.6), menu)
        val sizes = listOf(t("Choose a size"), t("Small"), t("Medium"), t("Large"), t("Back"), t("Cola ₹60"))
        assertNull(cache.get(cache.key(sizes, 1.6)))
    }

    @Test fun differentShapeMisses() {
        val cache = LocalLayoutCache(InMemoryLayoutStore())
        cache.put(cache.key(menuTokens, 1.6), menu)
        assertNull(cache.get(cache.key(menuTokens, 0.6)))
        assertNotNull(cache.get(cache.key(menuTokens, 1.65)))
    }

    @Test fun screensWithoutStableWordsAreNeverCached() {
        val cache = LocalLayoutCache(InMemoryLayoutStore())
        val digits = listOf(t("1"), t("2"), t("3"), t("₹149"))
        assertNull(cache.keyIfStable(digits, 1.0))
        assertNull(cache.keyIfStable(emptyList(), 1.0))
        assertNotNull(cache.keyIfStable(menuTokens, 1.6))
    }

    @Test fun lruEvictsAt50() {
        val store = InMemoryLayoutStore()
        val cache = LocalLayoutCache(store)
        val rnd = Random(7)
        val keys = List(51) { rnd.nextLong() and LocalLayoutCache.TOKEN_BITS }
        keys.take(50).forEach { cache.put(it, menu) }
        assertNotNull(cache.get(keys[0]))  // touched: now the newest
        cache.put(keys[50], menu)
        assertNotNull(cache.get(keys[0]))
        assertNull(cache.get(keys[1]))
        assertEquals(50, store.entries.size)
    }

    @Test fun removeDropsTheMatchingEntry() {
        val cache = LocalLayoutCache(InMemoryLayoutStore())
        val k = cache.key(menuTokens, 1.6)
        cache.put(k, menu)
        cache.remove(k xor 1L)  // a near key removes the entry a lookup would return
        assertNull(cache.get(k))
    }

    @Test fun clearRemovesAll() {
        val store = InMemoryLayoutStore()
        val cache = LocalLayoutCache(store)
        cache.put(cache.key(menuTokens, 1.6), menu)
        cache.clear()
        assertNull(cache.get(cache.key(menuTokens, 1.6)))
        assertTrue(store.entries.isEmpty())
    }

    @Test fun entriesSurviveARestart() {
        val store = InMemoryLayoutStore()
        val k = LocalLayoutCache(store).run { key(menuTokens, 1.6).also { put(it, menu) } }
        assertEquals(menu, LocalLayoutCache(store).get(k))
    }

    @Test fun codecRoundTripsLabelsWithAnyCharacters() {
        val odd = CachedLayout(listOf(CachedElement("e1", "Tab\there, new\nline; ✓ हिंदी", "icon", box(0.0, 0.5))))
        val entries = listOf(123L to menu, -5L to odd)
        assertEquals(entries, LayoutCacheCodec.decode(LayoutCacheCodec.encode(entries)))
        assertEquals(emptyList<Pair<Long, CachedLayout>>(), LayoutCacheCodec.decode("garbage\u0000"))
    }
}
