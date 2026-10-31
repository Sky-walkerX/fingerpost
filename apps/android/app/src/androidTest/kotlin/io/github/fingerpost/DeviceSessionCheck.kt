package io.github.fingerpost

import android.app.Activity
import android.app.Instrumentation
import android.os.Bundle
import io.github.fingerpost.protocol.*
import io.github.fingerpost.session.SessionClient
import io.github.fingerpost.session.newId
import io.github.fingerpost.session.nowMs
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.filterIsInstance
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull

/** Checks the installed client's USB gateway path without camera, microphone, credentials or model calls. */
internal object DeviceSessionCheck {
    fun run(instrumentation: Instrumentation) {
        val gateway = Class.forName("io.github.fingerpost.BuildConfig").getField("GATEWAY_URL").get(null) as String
        val loopback = gateway == "ws://127.0.0.1:8080"
        var ready = false
        var connected = false
        if (loopback) runBlocking {
            val client = SessionClient(hello = { Hello(newId(), nowMs(), BuildConfig.VERSION_NAME, PROTOCOL,
                io.github.fingerpost.protocol.Locale.EN, RequestedMode.GUIDE, Privacy.NORMAL, Caps()) })
            val response = async(start = CoroutineStart.UNDISPATCHED) {
                withTimeoutOrNull(12_000) { client.messages.filterIsInstance<Ready>().first() }
            }
            try {
                client.start()
                ready = response.await() != null
                connected = client.connected.value
            } finally { client.close(); response.cancelAndJoin() }
        }
        val passed = (if (ready) 1 else 0) + (if (connected) 1 else 0)
        val result = Bundle().apply {
            putInt("tests", 2); putInt("passed", passed); putInt("failed", 2 - passed)
            putBoolean("loopbackGatewayConfigured", loopback)
            putBoolean("emulatorGatewayConfigured", gateway.startsWith("ws://10.0.2.2:"))
            putBoolean("readyReceived", ready); putBoolean("socketConnected", connected)
        }
        instrumentation.finish(if (passed == 2) Activity.RESULT_OK else Activity.RESULT_CANCELED, result)
    }
}
