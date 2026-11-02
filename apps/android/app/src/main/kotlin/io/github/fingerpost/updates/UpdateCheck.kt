package io.github.fingerpost.updates

import android.content.Context
import io.github.fingerpost.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/** Public metadata only; never attaches session credentials or camera data. */
class UpdateCheck(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences("release-notices", Context.MODE_PRIVATE)
    suspend fun latestUnannounced(): String? = withContext(Dispatchers.IO) {
        try {
            val client = OkHttpClient.Builder().callTimeout(5, TimeUnit.SECONDS).followRedirects(false).build()
            val request = Request.Builder()
                .url("https://api.github.com/repos/Sky-walkerX/fingerpost/releases/latest")
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "Fingerpost/${BuildConfig.VERSION_NAME}").build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val body = response.body ?: return@withContext null
                val bytes = body.byteStream().use { stream ->
                    val output = java.io.ByteArrayOutputStream()
                    val buffer = ByteArray(4096)
                    while (output.size() <= 65_536) {
                        val count = stream.read(buffer, 0, minOf(buffer.size, 65_537 - output.size()))
                        if (count < 0) break
                        output.write(buffer, 0, count)
                    }
                    output.toByteArray()
                }
                if (bytes.size > 65_536) return@withContext null
                val release = Json.parseToJsonElement(bytes.decodeToString()).jsonObject
                if (release["draft"]?.jsonPrimitive?.booleanOrNull != false ||
                    release["prerelease"]?.jsonPrimitive?.booleanOrNull != false) return@withContext null
                val tag = release["tag_name"]?.jsonPrimitive?.content ?: return@withContext null
                tag.takeIf { ReleaseVersion.isNewer(it, BuildConfig.VERSION_NAME) &&
                    preferences.getString("announced", null) != it }
            }
        } catch (_: java.io.IOException) { null }
        catch (_: IllegalArgumentException) { null }
    }
    fun announced(tag: String) { preferences.edit().putString("announced", tag).apply() }
}
