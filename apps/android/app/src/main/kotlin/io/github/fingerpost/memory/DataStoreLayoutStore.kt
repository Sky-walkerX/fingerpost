package io.github.fingerpost.memory

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import io.github.fingerpost.guidance.CachedLayout
import io.github.fingerpost.guidance.LayoutCacheCodec
import io.github.fingerpost.guidance.LayoutStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull

private val Context.layoutDataStore: DataStore<Preferences> by preferencesDataStore(name = "layout_cache")

fun layoutStore(context: Context): DataStoreLayoutStore = DataStoreLayoutStore(context.applicationContext.layoutDataStore)

/**
 * A5-2: the on-device layout cache's storage. Layout structure only (ids, labels, roles, polygons): no images,
 * no prices. It stays on this phone and "Clear saved screens" in settings empties it.
 */
class DataStoreLayoutStore(private val store: DataStore<Preferences>) : LayoutStore {
    private val io = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Read once, when the cache is first used; a slow or failed read just starts with an empty cache. */
    override fun load(): List<Pair<Long, CachedLayout>> = runCatching {
        runBlocking(Dispatchers.IO) { withTimeoutOrNull(500) { store.data.first()[ENTRIES] } }
    }.getOrNull()?.let(LayoutCacheCodec::decode).orEmpty()

    override fun save(entries: List<Pair<Long, CachedLayout>>) {
        val text = LayoutCacheCodec.encode(entries)
        io.launch { runCatching { store.edit { it[ENTRIES] = text } } }
    }

    override fun clear() { io.launch { runCatching { store.edit { it.remove(ENTRIES) } } } }

    /** For the settings screen: empties the saved screens even when no session is running. */
    suspend fun clearNow() { runCatching { store.edit { it.remove(ENTRIES) } } }

    private companion object { val ENTRIES = stringPreferencesKey("entries") }
}


private val DEVICE_ENTRIES = stringPreferencesKey("named_devices")
fun savedDevices(context: Context): io.github.fingerpost.guidance.SavedDevices {
    val store = context.applicationContext.layoutDataStore
    val initial = runCatching { runBlocking(Dispatchers.IO) { withTimeoutOrNull(500) { store.data.first()[DEVICE_ENTRIES] } } }
        .getOrNull()?.let(io.github.fingerpost.guidance.SavedDevicesCodec::decode).orEmpty()
    val writer = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    val pending = kotlinx.coroutines.channels.Channel<String>(kotlinx.coroutines.channels.Channel.UNLIMITED)
    writer.launch { for (encoded in pending) runCatching { store.edit { it[DEVICE_ENTRIES] = encoded } } }
    return io.github.fingerpost.guidance.SavedDevices(initial) { devices ->
        val encoded = io.github.fingerpost.guidance.SavedDevicesCodec.encode(devices)
        pending.trySend(encoded)
    }
}
