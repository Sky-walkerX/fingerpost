package io.github.fingerpost.donation

import io.github.fingerpost.BuildConfig
import io.github.fingerpost.guidance.DonationPacket
import io.github.fingerpost.guidance.DONATION_CONSENT_VERSION
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import okhttp3.Call
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit

/** No files, retries, redirects, body logging or credentials on storage PUTs. */
class DonationUploader internal constructor(
    private val baseUrl: String = BuildConfig.GATEWAY_URL.replaceFirst("ws","http"),
    private val token: suspend () -> String?,
    private val allowed: () -> Boolean,
    private val now: () -> Long = System::currentTimeMillis,
    private val storageAllowed: (HttpUrl) -> Boolean = { safeStorageUrl(it.toString()) },
) {
    private val client=OkHttpClient.Builder().callTimeout(30,TimeUnit.SECONDS)
        .followRedirects(false).followSslRedirects(false).build()
    private val lock=Any()
    private val calls=mutableMapOf<Call,Long>()
    private var epoch=0L
    private var closed=false
    @Serializable private data class Upload(val index:Int,val kind:String,val method:String,val url:String,val headers:Map<String,String>)
    @Serializable private data class Grant(val donationId:String,val uploadExpiresAt:Long,val deleteAfter:Long,val uploads:List<Upload>)

    suspend fun upload(packet:DonationPacket,locale:String):Boolean=withContext(Dispatchers.IO) {
        val started=synchronized(lock) { if (closed) return@withContext false; epoch }
        fun active()=synchronized(lock) { !closed && epoch==started && allowed() }
        if (!active()) return@withContext false
        try {
            require(packet.outcome in setOf("failed","wrong","nochange") && packet.frames.size in 1..20)
            require(packet.frames.all { it.jpeg.size in 1..409_600 })
            val replay=replay(packet); require(replay.size in 1..262_144)
            val contents=packet.frames.map { it.jpeg }+listOf(replay)
            val kinds=packet.frames.map { "keyframe" }+"replay"
            val types=packet.frames.map { "image/jpeg" }+"application/json"
            val body=buildJsonObject {
                put("consent",buildJsonObject { put("version",DONATION_CONSENT_VERSION);put("accepted",true) })
                put("redacted",buildJsonObject { put("faces",true);put("cardNumbers",true) })
                put("locale",locale.takeIf { it in setOf("en","hi","es") }?:"en");put("outcome",packet.outcome)
                put("files",buildJsonArray { contents.forEachIndexed { i,bytes -> add(buildJsonObject {
                    put("kind",kinds[i]);put("contentType",types[i]);put("bytes",bytes.size)
                }) } })
            }.toString().toRequestBody("application/json".toMediaType())
            val metadata=Request.Builder().url("$baseUrl/v1/donate").post(body)
            token()?.let { metadata.header("Authorization","Bearer $it") }
            if (!active()) return@withContext false
            val grant=execute(metadata.build(),started).use { response ->
                if (!response.isSuccessful) return@withContext false
                val bytes=response.body.byteStream().use { stream ->
                    val out=java.io.ByteArrayOutputStream();val buffer=ByteArray(4096)
                    while(out.size()<=65_536) {
                        val n=stream.read(buffer,0,minOf(buffer.size,65_537-out.size()))
                        if(n<0) break
                        out.write(buffer,0,n)
                    };out.toByteArray()
                }
                require(bytes.size<=65_536)
                Json.decodeFromString<Grant>(bytes.decodeToString())
            }
            val time=now()
            require(grant.donationId.matches(Regex("[A-Za-z0-9_-]{1,64}")) && grant.uploadExpiresAt>time &&
                grant.uploadExpiresAt-time<=900_000 && grant.deleteAfter-grant.uploadExpiresAt==7_775_100_000L)
            require(grant.uploads.size==contents.size && grant.uploads.map { it.index }.toSet()==contents.indices.toSet())
            // Validate the entire grant before the first byte goes to storage.
            for (u in grant.uploads) {
                val i=u.index;require(u.kind==kinds[i] && u.method=="PUT")
                val url=requireNotNull(u.url.toHttpUrlOrNull());require(storageAllowed(url))
                require(u.headers==mapOf("content-type" to types[i],"x-goog-content-length-range" to "1,${contents[i].size}"))
            }
            for (u in grant.uploads.sortedBy { it.index }) {
                if (!active() || now()>=grant.uploadExpiresAt) return@withContext false
                val request=Request.Builder().url(u.url).put(contents[u.index].toRequestBody(types[u.index].toMediaType()))
                u.headers.forEach { (name,value) -> request.header(name,value) }
                execute(request.build(),started).use { if (!it.isSuccessful) return@withContext false }
            }
            active()
        } catch (_:IOException) { false } catch (_:IllegalArgumentException) { false }
        finally { synchronized(lock) { calls.entries.removeAll { it.value==started } } }
    }
    private fun execute(request:Request,started:Long):Response {
        val call=synchronized(lock) {
            if(closed || epoch!=started || !allowed()) throw IOException("Donation cancelled")
            client.newCall(request).also { calls[it]=started }
        }
        return try { call.execute() } catch (error:IOException) { synchronized(lock) { calls.remove(call) };throw error }
    }
    fun cancel()=synchronized(lock) { epoch++;calls.keys.forEach(Call::cancel);calls.clear() }
    fun close() { synchronized(lock) { closed=true };cancel();client.dispatcher.executorService.shutdown();client.connectionPool.evictAll() }
    companion object {
        fun safeStorageUrl(raw:String):Boolean {
            val u=raw.toHttpUrlOrNull()?:return false
            return u.scheme=="https" && u.port==443 && u.username.isEmpty() && u.password.isEmpty() && u.fragment==null &&
                (u.host=="storage.googleapis.com" || u.host.endsWith(".storage.googleapis.com"))
        }
        internal fun replay(packet:DonationPacket):ByteArray=buildJsonObject {
            put("version",1);put("samples",buildJsonArray {
                for(f in packet.frames) add(buildJsonObject {
                    put("offsetMs",f.pose.offsetMs)
                    fun point(p:io.github.fingerpost.guidance.Vec2)=buildJsonObject { put("x",p.x);put("y",p.y) }
                    put("quad",f.pose.quad?.let { q -> buildJsonArray { q.forEach { add(point(it)) } } }?:JsonNull)
                    put("finger",f.pose.finger?.let(::point)?:JsonNull)
                })
            })
        }.toString().toByteArray()
    }
}
