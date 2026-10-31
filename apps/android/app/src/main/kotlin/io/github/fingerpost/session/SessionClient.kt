package io.github.fingerpost.session

import android.util.Log
import io.github.fingerpost.BuildConfig
import io.github.fingerpost.protocol.ClientMessage
import io.github.fingerpost.protocol.Frame
import io.github.fingerpost.protocol.ServerMessage
import io.github.fingerpost.protocol.ServerParse
import io.github.fingerpost.protocol.encodeClientMessage
import io.github.fingerpost.protocol.parseServerMessage
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.random.Random
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString.Companion.toByteString

fun newId(): String = UUID.randomUUID().toString()
fun nowMs(): Long = System.currentTimeMillis()

/**
 * One fp.v1 WebSocket (docs/protocol.md). Reconnects with 0.5 s → 8 s jittered backoff and re-sends hello.
 * [token] supplies the session JWT (Day 3); null connects unauthenticated (mock/dev gateway).
 */
class SessionClient(
    private val hello: () -> ClientMessage,
    private val token: suspend () -> String? = { null },
    private val url: String = BuildConfig.GATEWAY_URL + "/v1/session",
    private val onAuthExpired: suspend () -> Unit = {},
    private val refreshAfterMs: () -> Long = { 12 * 60_000L },
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val http = OkHttpClient.Builder().pingInterval(15, TimeUnit.SECONDS).build()
    private val mutableMessages = MutableSharedFlow<ServerMessage>(extraBufferCapacity = 64)
    val messages: SharedFlow<ServerMessage> = mutableMessages
    private val mutableConnected = MutableStateFlow(false)
    val connected: StateFlow<Boolean> = mutableConnected

    @Volatile private var socket: WebSocket? = null
    @Volatile private var closed = false
    private var backoffMs = 500L
    private var reconnect: Job? = null
    private var refresh: Job? = null

    fun start() {
        closed = false
        connect()
    }

    private fun connect() {
        scope.launch {
            val request = Request.Builder().url(url).header("Fp-Protocol", "fp.v1")
            token()?.let { request.header("Authorization", "Bearer $it") }
            if (closed) return@launch
            socket = http.newWebSocket(request.build(), listener)
        }
    }

    private val listener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            if (closed || webSocket !== socket) { webSocket.close(1000, null); return }
            backoffMs = 500L
            mutableConnected.value = true
            webSocket.send(encodeClientMessage(hello()))
            refresh?.cancel()
            if (response.request.header("Authorization") != null) refresh = scope.launch {
                delay(refreshAfterMs().coerceAtLeast(0))
                if (!closed && webSocket === socket) reconnect()
            }
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            if (closed || webSocket !== socket) return
            when (val parsed = parseServerMessage(text)) {
                is ServerParse.Ok -> if (!mutableMessages.tryEmit(parsed.msg)) webSocket.cancel()
                is ServerParse.Unknown -> Unit
                is ServerParse.Invalid -> if (BuildConfig.DEBUG) Log.w(TAG, "invalid server message")
            }
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) = webSocket.close(code, null).let { }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = scheduleReconnect(webSocket, code == 4401)

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) = scheduleReconnect(webSocket)
    }

    private fun scheduleReconnect(from: WebSocket, authExpired: Boolean = false) {
        if (from !== socket) return
        mutableConnected.value = false
        refresh?.cancel()
        socket = null
        if (closed) return
        val wait = (backoffMs * (0.75 + Random.nextDouble() * 0.5)).toLong()
        backoffMs = minOf(backoffMs * 2, 8_000L)
        reconnect?.cancel()
        reconnect = scope.launch {
            if (authExpired) onAuthExpired()
            delay(wait)
            if (!closed) connect()
        }
    }

    fun send(message: ClientMessage): Boolean = socket?.send(encodeClientMessage(message)) ?: false

    fun send(header: ClientMessage, payload: ByteArray): Boolean = socket?.send(Frame.encode(header, payload).toByteString()) ?: false

    fun reconnect() {
        reconnect?.cancel()
        refresh?.cancel()
        val previous = socket
        socket = null
        mutableConnected.value = false
        previous?.cancel()
        if (!closed) connect()
    }

    fun close() {
        closed = true
        reconnect?.cancel()
        refresh?.cancel()
        mutableConnected.value = false
        socket?.close(1000, null)
        socket = null
        scope.cancel()
        http.dispatcher.executorService.shutdown()
        http.connectionPool.evictAll()
    }

    private companion object { const val TAG = "FingerpostSession" }
}
