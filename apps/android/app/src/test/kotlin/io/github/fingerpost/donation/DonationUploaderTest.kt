package io.github.fingerpost.donation

import com.sun.net.httpserver.HttpServer
import io.github.fingerpost.guidance.*
import java.net.InetSocketAddress
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.async
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withTimeout
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class DonationUploaderTest {
    private fun packet() = DonationPacket("failed",listOf(DonationFrame(byteArrayOf(1,2,3),DonationPose(0,null,null))))
    @Test fun explicitConsentAllowsBoundedUploadsWithoutForwardingAuthToStorage() = runBlocking {
        val server=HttpServer.create(InetSocketAddress("127.0.0.1",0),0); val puts=AtomicInteger()
        val base="http://127.0.0.1:${server.address.port}"; val now=1000L
        server.createContext("/v1/donate") { x ->
            assertEquals("Bearer synthetic-token",x.requestHeaders.getFirst("Authorization"))
            val text=x.requestBody.readBytes().decodeToString()
            assertTrue(text.contains("donate.v1")); assertFalse(text.contains("fingerprint"));
            val body="""{"donationId":"synthetic","uploadExpiresAt":901000,"deleteAfter":7776001000,"uploads":[{"index":0,"kind":"keyframe","method":"PUT","url":"$base/a","headers":{"content-type":"image/jpeg","x-goog-content-length-range":"1,3"}},{"index":1,"kind":"replay","method":"PUT","url":"$base/b","headers":{"content-type":"application/json","x-goog-content-length-range":"1,REPLAY_SIZE"}}]}"""
            val replay=DonationUploader.replay(packet()).size
            val data=body.replace("REPLAY_SIZE",replay.toString()).toByteArray()
            x.sendResponseHeaders(200,data.size.toLong()); x.responseBody.use { it.write(data) }
        }
        server.createContext("/") { x ->
            assertEquals("PUT",x.requestMethod); assertNull(x.requestHeaders.getFirst("Authorization"))
            assertTrue(x.requestBody.readBytes().isNotEmpty()); puts.incrementAndGet(); x.sendResponseHeaders(204,-1); x.close()
        }
        server.start()
        val uploader=DonationUploader(base,{ "synthetic-token" },{ true },{ now },{ it.host=="127.0.0.1" })
        try { assertTrue(uploader.upload(packet(),"en")); assertEquals(2,puts.get()) }
        finally { uploader.close(); server.stop(0) }
    }
    @Test fun revokedConsentCannotEvenRequestUploadUrls() = runBlocking {
        val requested=AtomicInteger()
        val uploader=DonationUploader("http://127.0.0.1:1",{ requested.incrementAndGet(); "synthetic" },{ false })
        try { assertFalse(uploader.upload(packet(),"en")); assertEquals(0,requested.get()) } finally { uploader.close() }
    }
    @Test fun onlyHttpsGoogleStorageDestinationsAreAccepted() {
        for (url in listOf("http://storage.googleapis.com/a","https://storage.googleapis.com.evil.invalid/a",
            "https://example.invalid/a","https://user@storage.googleapis.com/a","https://storage.googleapis.com/a#fragment"))
            assertFalse(DonationUploader.safeStorageUrl(url))
        assertTrue(DonationUploader.safeStorageUrl("https://storage.googleapis.com/synthetic/object?signature=synthetic"))
    }
    @Test fun anInvalidLaterDestinationPreventsEveryStoragePut() = runBlocking {
        val server=HttpServer.create(InetSocketAddress("127.0.0.1",0),0)
        val base="http://127.0.0.1:${server.address.port}"; val puts=AtomicInteger()
        server.createContext("/v1/donate") { x ->
            val size=DonationUploader.replay(packet()).size
            val data="""{"donationId":"synthetic","uploadExpiresAt":901000,"deleteAfter":7776001000,"uploads":[{"index":0,"kind":"keyframe","method":"PUT","url":"$base/object","headers":{"content-type":"image/jpeg","x-goog-content-length-range":"1,3"}},{"index":1,"kind":"replay","method":"PUT","url":"https://synthetic.invalid/object","headers":{"content-type":"application/json","x-goog-content-length-range":"1,$size"}}]}""".toByteArray()
            x.sendResponseHeaders(200,data.size.toLong()); x.responseBody.use { it.write(data) }
        }
        server.createContext("/object") { x -> puts.incrementAndGet();x.sendResponseHeaders(204,-1);x.close() }
        server.start()
        val uploader=DonationUploader(base,{null},{true},{1000L},{it.host=="127.0.0.1"})
        try { assertFalse(uploader.upload(packet(),"en"));assertEquals(0,puts.get()) }
        finally { uploader.close();server.stop(0) }
    }
    @Test fun pinOrLifecycleCancellationInterruptsAStalledMetadataBody() = runBlocking {
        val server=HttpServer.create(InetSocketAddress("127.0.0.1",0),0)
        val started=CountDownLatch(1);val release=CountDownLatch(1)
        server.createContext("/v1/donate") { x ->
            x.sendResponseHeaders(200,100);x.responseBody.write(byteArrayOf(123));x.responseBody.flush()
            started.countDown();release.await(3,TimeUnit.SECONDS);x.close()
        }
        server.start()
        val uploader=DonationUploader("http://127.0.0.1:${server.address.port}",{null},{true})
        try {
            val work=async(Dispatchers.IO) { uploader.upload(packet(),"en") }
            assertTrue(started.await(3,TimeUnit.SECONDS));uploader.cancel()
            assertFalse(withTimeout(1000) { work.await() })
        } finally { release.countDown();uploader.close();server.stop(0) }
    }
}
