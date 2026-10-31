package io.github.fingerpost.session

import io.github.fingerpost.protocol.*
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import java.util.Base64
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class SessionRefreshTest {
    private fun hello() = Hello("synthetic-hello", 1, "0.1.0", PROTOCOL,
        io.github.fingerpost.protocol.Locale.EN, RequestedMode.GUIDE, Privacy.NORMAL, Caps())

    @Test fun `authenticated socket renews its token before the fifteen minute expiry`() = runBlocking {
        UpgradeServer().use { server ->
            val issued = AtomicInteger()
            val client = SessionClient(::hello, token = { "synthetic-${issued.incrementAndGet()}" },
                url = server.url, refreshAfterMs = { 80 })
            try {
                client.start()
                assertTrue(server.awaitConnections(2))
                assertEquals(listOf("Bearer synthetic-1", "Bearer synthetic-2"), server.authorizations.take(2))
                client.close()
                assertFalse(client.connected.value)
                val count = issued.get()
                Thread.sleep(180)
                assertEquals(count, issued.get())
            } finally { client.close() }
        }
    }

    @Test fun `unauthenticated development socket has no token renewal loop`() = runBlocking {
        UpgradeServer().use { server ->
            val issued = AtomicInteger()
            val client = SessionClient(::hello, token = { issued.incrementAndGet(); null },
                url = server.url, refreshAfterMs = { 50 })
            try {
                client.start()
                withTimeout(3000) { client.connected.first { it } }
                Thread.sleep(150)
                assertEquals(1, issued.get())
                assertEquals(listOf<String?>(null), server.authorizations.toList())
            } finally { client.close() }
        }
    }

    private class UpgradeServer : AutoCloseable {
        private val server = ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"))
        private val executor = Executors.newCachedThreadPool()
        private val sockets = CopyOnWriteArrayList<Socket>()
        val authorizations = CopyOnWriteArrayList<String?>()
        val url = "ws://127.0.0.1:${server.localPort}/v1/session"
        init {
            executor.execute {
                while (!server.isClosed) {
                    val socket = runCatching { server.accept() }.getOrNull() ?: break
                    sockets += socket
                    executor.execute { runCatching { upgrade(socket) } }
                }
            }
        }
        private fun upgrade(socket: Socket) {
            socket.soTimeout = 3000
            val reader = socket.getInputStream().bufferedReader(Charsets.US_ASCII)
            val headers = mutableMapOf<String,String>()
            while (true) {
                val line = reader.readLine() ?: return
                if (line.isEmpty()) break
                val colon = line.indexOf(':')
                if (colon > 0) headers[line.substring(0,colon).lowercase()] = line.substring(colon+1).trim()
            }
            val key = requireNotNull(headers["sec-websocket-key"])
            val accept = Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-1")
                .digest((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").toByteArray(Charsets.US_ASCII)))
            socket.getOutputStream().apply {
                write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
                    "Sec-WebSocket-Accept: $accept\r\n\r\n").toByteArray(Charsets.US_ASCII)); flush()
            }
            authorizations += headers["authorization"]
        }
        fun awaitConnections(count: Int): Boolean {
            val deadline = System.nanoTime() + 3_000_000_000L
            while (authorizations.size < count && System.nanoTime() < deadline) Thread.sleep(10)
            return authorizations.size >= count
        }
        override fun close() {
            server.close(); sockets.forEach { it.close() }; executor.shutdownNow()
        }
    }
}
