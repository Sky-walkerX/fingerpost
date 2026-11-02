package io.github.fingerpost.guidance

import kotlin.math.abs
import kotlin.math.ln
import kotlin.math.roundToInt

/** One remembered control, in screen-normalized units. No images, no OCR text beyond the label. */
data class CachedElement(val id: String, val label: String, val role: String, val polygon: List<Vec2>)
data class CachedLayout(val elements: List<CachedElement>)

/** Persistence for [LocalLayoutCache]; entries oldest first. The app backs it with DataStore. */
interface LayoutStore {
    fun load(): List<Pair<Long, CachedLayout>>
    fun save(entries: List<Pair<Long, CachedLayout>>)
    fun clear()
}

class InMemoryLayoutStore : LayoutStore {
    var entries: List<Pair<Long, CachedLayout>> = emptyList(); private set
    override fun load() = entries
    override fun save(entries: List<Pair<Long, CachedLayout>>) { this.entries = entries }
    override fun clear() { entries = emptyList() }
}

/**
 * Days 4–7 plan, A5-2 (guidance-spec §11c): the user's own screens, on the phone, for an instant re-lock.
 * Key = 4-bit aspect bucket (top bits) + 60-bit SimHash of character trigrams of the stable OCR words (words
 * with digits or currency symbols dropped, so prices and order numbers don't matter). A lookup hits the
 * nearest entry within Hamming 3 on the SimHash bits and at most one aspect bucket away. LRU, [max] entries.
 */
class LocalLayoutCache(private val store: LayoutStore, private val max: Int = 50) {
    private val entries: LinkedHashMap<Long, CachedLayout> by lazy {
        LinkedHashMap<Long, CachedLayout>(max + 1, 0.75f, true).also { m -> store.load().takeLast(max).forEach { (k, v) -> m[k] = v } }
    }

    /** null when the screen has no stable words to recognise it by (keypads, prices only, blank). */
    fun keyIfStable(tokens: List<OcrToken>, aspect: Double): Long? {
        val grams = grams(tokens)
        return if (grams.isEmpty() || !aspect.isFinite() || aspect <= 0) null else (bucket(aspect).toLong() shl 60) or simhash(grams)
    }

    fun key(tokens: List<OcrToken>, aspect: Double): Long = keyIfStable(tokens, aspect) ?: 0L

    fun get(key: Long): CachedLayout? = nearest(key)?.let { entries[it] }.also { if (it != null) persist() }

    fun put(key: Long, layout: CachedLayout) {
        nearest(key)?.let { entries.remove(it) }
        entries[key] = layout
        while (entries.size > max) entries.remove(entries.keys.first())
        persist()
    }

    /** Drops the entry a lookup of [key] would return (OCR disagreed with it). */
    fun remove(key: Long) { nearest(key)?.let { entries.remove(it); persist() } }

    fun clear() { entries.clear(); store.clear() }

    private fun persist() = store.save(entries.entries.map { it.key to it.value })

    private fun nearest(key: Long): Long? = entries.keys
        .filter { abs(bucketOf(it) - bucketOf(key)) <= 1 && java.lang.Long.bitCount((it xor key) and TOKEN_BITS) <= 3 }
        .minByOrNull { java.lang.Long.bitCount((it xor key) and TOKEN_BITS) }

    companion object {
        const val TOKEN_BITS: Long = (1L shl 60) - 1
        private fun bucketOf(key: Long) = (key ushr 60).toInt()

        /** 16 log-spaced buckets over aspect 1/3 … 3 (about 16% wide). */
        fun bucket(aspect: Double): Int = ((ln(aspect) + ln(3.0)) / (2 * ln(3.0)) * 15).roundToInt().coerceIn(0, 15)

        private val unstable = Regex("[\\p{Nd}\\p{Sc}]")
        fun grams(tokens: List<OcrToken>): List<String> = tokens
            .flatMap { it.text.split(Regex("\\s+")) }
            .filter { it.isNotBlank() && !unstable.containsMatchIn(it) }
            .map(::normalizeLabel).filter { it.isNotEmpty() }
            .flatMap { w -> "^$w$".windowed(3, partialWindows = false).ifEmpty { listOf("^$w$") } }

        private fun fnv(s: String): Long {
            var h = -0x340d631b7bdddcdbL
            for (c in s) { h = h xor c.code.toLong(); h *= 0x100000001b3L }
            return h
        }

        fun simhash(features: List<String>): Long {
            val sums = IntArray(60)
            for (f in features) { val h = fnv(f); for (b in 0 until 60) sums[b] += if ((h ushr b) and 1L == 1L) 1 else -1 }
            var out = 0L
            for (b in 0 until 60) if (sums[b] > 0) out = out or (1L shl b)
            return out
        }
    }
}

/** A text form for one DataStore string: unit/record separators, so any label survives. */
object LayoutCacheCodec {
    private const val FS = '\u001c'; private const val GS = '\u001d'; private const val RS = '\u001e'; private const val US = '\u001f'
    private fun clean(s: String) = s.filter { it != FS && it != GS && it != RS && it != US }

    fun encode(entries: List<Pair<Long, CachedLayout>>): String = entries.joinToString(FS.toString()) { (k, layout) ->
        k.toString() + GS + layout.elements.joinToString(RS.toString()) { e ->
            listOf(clean(e.id), clean(e.label), clean(e.role), e.polygon.joinToString(",") { "${it.x},${it.y}" }).joinToString(US.toString())
        }
    }

    fun decode(text: String): List<Pair<Long, CachedLayout>> = runCatching {
        text.split(FS).filter { it.isNotEmpty() }.map { line ->
            val (k, body) = line.split(GS, limit = 2).also { require(it.size == 2) }
            k.toLong() to CachedLayout(body.split(RS).filter { it.isNotEmpty() }.map { rec ->
                val f = rec.split(US); require(f.size == 4)
                val n = f[3].split(",").map(String::toDouble); require(n.size >= 6 && n.size % 2 == 0)
                CachedElement(f[0], f[1], f[2], n.chunked(2) { Vec2(it[0], it[1]) })
            })
        }
    }.getOrDefault(emptyList())
}

/**
 * A5-2 re-lock decision for a cache hit (guidance-spec §11c). Only plain controls are guided from the cache,
 * and only when fresh OCR inside the cached box agrees with its label (§11 two-source rule). Pay, confirm and
 * submit targets, icons and anything the goal doesn't name exactly enough wait for the gateway.
 */
sealed interface CacheRelock {
    data class Guide(val element: CachedElement, val say: String) : CacheRelock
    /** The cached element's label isn't on the screen any more: forget this entry. */
    data object Drop : CacheRelock
    data object Server : CacheRelock

    companion object {
        private val gatewayOnly = setOf("pay", "confirm", "submit", "icon", "text")

        fun decide(goal: String, layout: CachedLayout, screenTokens: List<OcrToken>, locale: java.util.Locale): CacheRelock {
            val candidates = layout.elements.filter { it.role != "text" && it.polygon.size >= 3 }
            val asTokens = candidates.map { e -> Bbox.of(e.polygon).let { b -> OcrToken(e.label, b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY) } }
            val hit = OfflineResolver.resolve(goal, asTokens) as? OfflineResult.Match ?: return Server
            val element = candidates[asTokens.indexOf(hit.token)]
            if (element.role in gatewayOnly) return Server
            if (!twoSourceAgree(element.label, Bbox.of(element.polygon), screenTokens)) return Drop
            return Guide(element, OfflinePhrases.found(hit.token, locale))
        }
    }
}
