package io.github.fingerpost.guidance

import java.util.Base64
import java.util.Locale

/** Saved names, screen-space controls and a hashed fingerprint only. No image or OCR transcript. */
data class SavedDevice(val name: String, val key: Long, val layout: CachedLayout, val savedAt: Long)
class SavedDevices(initial: List<SavedDevice> = emptyList(), private val persist: (List<SavedDevice>) -> Unit = {}) {
    private val entries = initial.filter { validLayout(it.layout) && validName(it.name) }.takeLast(maxDevices).toMutableList()
    fun list(now: Long): List<SavedDevice> {
        if (entries.removeAll { now < it.savedAt || now-it.savedAt > maxAgeMs }) flush()
        return entries.toList()
    }
    fun save(name: String,key: Long,layout: CachedLayout,now: Long,screenType: String,sensitive: Boolean): Boolean {
        if (screenType != "appliance" || sensitive || !validName(name) || !validLayout(layout)) return false
        entries.removeAll { it.key == key }
        entries += SavedDevice(name.trim(),key,layout,now)
        while(entries.size > maxDevices) entries.removeAt(0)
        flush();return true
    }
    fun rename(key: Long,name: String): Boolean {
        if(!validName(name)) return false
        val index=entries.indexOfFirst { it.key==key };if(index<0) return false
        entries[index]=entries[index].copy(name=name.trim());flush();return true
    }
    fun delete(key: Long): Boolean = entries.removeAll { it.key==key }.also { if(it) flush() }
    fun find(key: Long,goal: String,tokens: List<OcrToken>,now: Long,locale: Locale): CacheRelock.Guide? {
        val device=list(now).filter { kotlin.math.abs((it.key ushr 60).toInt()-(key ushr 60).toInt())<=1 &&
            java.lang.Long.bitCount((it.key xor key) and LocalLayoutCache.TOKEN_BITS)<=3 }
            .minByOrNull { java.lang.Long.bitCount((it.key xor key) and LocalLayoutCache.TOKEN_BITS) } ?: return null
        return when(val result=CacheRelock.decide(goal,device.layout,tokens,locale)) {
            is CacheRelock.Guide -> result
            CacheRelock.Drop -> { delete(device.key);null }
            CacheRelock.Server -> null
        }
    }
    private fun flush() = persist(entries.toList())
    companion object {
        const val maxDevices=10
        const val maxAgeMs=180L*24*60*60*1000
        fun validName(name: String)=name.trim().length in 1..40 && name.none { it.isISOControl() }
        fun validLayout(layout: CachedLayout)=layout.elements.isNotEmpty() && layout.elements.size<=60 && layout.elements.all {
            it.role !in setOf("pay","confirm","submit","key","input") && it.label.length in 1..200 &&
                it.polygon.size in 3..32 && it.polygon.all { p->p.x.isFinite()&&p.y.isFinite()&&p.x in 0.0..1.0&&p.y in 0.0..1.0 }
        }
    }
}
object SavedDevicesCodec {
    fun encode(devices: List<SavedDevice>)=devices.joinToString("\n") {
        listOf(Base64.getEncoder().encodeToString(it.name.toByteArray(Charsets.UTF_8)),it.savedAt.toString(),
            Base64.getEncoder().encodeToString(LayoutCacheCodec.encode(listOf(it.key to it.layout)).toByteArray(Charsets.UTF_8))).joinToString("|")
    }
    fun decode(text: String): List<SavedDevice> = if(text.length>1_048_576) emptyList() else text.lineSequence().take(SavedDevices.maxDevices).mapNotNull { line->
        runCatching {
            val parts=line.split('|');require(parts.size==3)
            val name=String(Base64.getDecoder().decode(parts[0]),Charsets.UTF_8)
            val (key,layout)=LayoutCacheCodec.decode(String(Base64.getDecoder().decode(parts[2]),Charsets.UTF_8)).single()
            require(SavedDevices.validName(name)&&SavedDevices.validLayout(layout))
            SavedDevice(name,key,layout,parts[1].toLong())
        }.getOrNull()
    }.toList()
}
