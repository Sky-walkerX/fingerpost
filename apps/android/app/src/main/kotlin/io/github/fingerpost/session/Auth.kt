package io.github.fingerpost.session

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import android.util.Base64
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import io.github.fingerpost.BuildConfig
import java.security.KeyPairGenerator
import java.security.KeyStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * ADR 0004: Firebase anonymous uid + Android Key Attestation → a 15-minute session JWT, held in memory only and
 * refreshed at 12 minutes. Returns null when Firebase isn't configured (no google-services.json): the app then
 * connects unauthenticated, which only a mock/dev gateway accepts.
 */
class Auth(private val context: Context, private val baseUrl: String = BuildConfig.GATEWAY_URL.replaceFirst("ws", "http")) {
    private val http = OkHttpClient()
    private val json = Json { ignoreUnknownKeys = true }
    private val mutex = Mutex()
    private var token: String? = null
    @Volatile private var expiresAt = 0L

    suspend fun token(): String? = mutex.withLock {
        if (token != null && System.currentTimeMillis() < expiresAt) return token
        token = runCatching { fetch() }.onFailure { if (BuildConfig.DEBUG) Log.w(TAG, "auth failed: ${it.javaClass.simpleName}") }.getOrNull()
        return token
    }

    /** Call on `error{code:auth_expired}` or a 4401 close. */
    suspend fun invalidate() = mutex.withLock { token = null }

    /** A socket reconnect must retain the token's original refresh deadline. */
    fun refreshAfterMs(): Long = (expiresAt - System.currentTimeMillis()).coerceAtLeast(0)

    private suspend fun fetch(): String? {
        if (FirebaseApp.getApps(context).isEmpty()) return null
        val auth = FirebaseAuth.getInstance()
        val user = auth.currentUser ?: auth.signInAnonymously().await().user ?: return null
        val idToken = user.getIdToken(false).await().token ?: return null
        return withContext(Dispatchers.IO) {
            val challenge = json.decodeFromString<Challenge>(post("/v1/auth/challenge", "{}"))
            val nonce = Base64.decode(challenge.nonce, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
            val chain = attest(nonce)
            val body = json.encodeToString(AttestRequest.serializer(), AttestRequest(challenge.challengeId, chain, idToken))
            val issued = json.decodeFromString<AttestResponse>(post("/v1/auth/attest", body))
            require(issued.token.isNotBlank() && issued.expiresIn in 1..900 && issued.tier in setOf("hardware", "software"))
            expiresAt = System.currentTimeMillis() + minOf(issued.expiresIn, 12 * 60) * 1000L
            if (BuildConfig.DEBUG) Log.i(TAG, "tier=${issued.tier}")
            issued.token
        }
    }

    private fun attest(nonce: ByteArray): List<String> {
        val spec = KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN)
            .setDigests(KeyProperties.DIGEST_SHA256).setAttestationChallenge(nonce)
        val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
        try {
            generator.initialize(spec.setIsStrongBoxBacked(true).build())
            generator.generateKeyPair()
        } catch (_: StrongBoxUnavailableException) {
            generator.initialize(spec.setIsStrongBoxBacked(false).build())
            generator.generateKeyPair()
        }
        val chain = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.getCertificateChain(ALIAS)
        return chain.map { Base64.encodeToString(it.encoded, Base64.NO_WRAP) }
    }

    private fun post(path: String, body: String): String {
        val request = Request.Builder().url(baseUrl + path).post(body.toRequestBody("application/json".toMediaType())).build()
        http.newCall(request).execute().use { response ->
            check(response.isSuccessful) { "HTTP ${response.code}" }
            return response.body.string()
        }
    }

    @Serializable private data class Challenge(val challengeId: String, val nonce: String)
    @Serializable private data class AttestRequest(val challengeId: String, val chain: List<String>, val firebaseIdToken: String)
    @Serializable private data class AttestResponse(val token: String, val expiresIn: Int, val tier: String)

    private companion object {
        const val TAG = "FingerpostAuth"
        const val ALIAS = "fp-attest"
    }
}
