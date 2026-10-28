package io.github.fingerpost.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Messages the gateway sends. Unknown types are ignored by [parseServerMessage], never fatal. */
@Serializable sealed class ServerMessage { abstract val id: String; abstract val ts: Long }

@Serializable data class QuotaInfo(val tasksLeft: Int) { init { require(tasksLeft >= 0) } }
@Serializable data class Flags(val cloudEnabled: Boolean, val privateAvailable: Boolean)

@Serializable @SerialName("ready")
data class Ready(override val id: String, override val ts: Long, val sessionId: String, val quota: QuotaInfo, val flags: Flags) : ServerMessage()

@Serializable @SerialName("transcript")
data class Transcript(override val id: String, override val ts: Long, val final: Boolean, val text: String) : ServerMessage()

@Serializable @SerialName("goal.ack")
data class GoalAck(override val id: String, override val ts: Long, val goal: String, val intent: Intent) : ServerMessage()

@Serializable data class LayoutElement(
    val id: String, val label: String, val labelLocal: String? = null, val role: ElementRole,
    val state: String? = null, val polygon: List<UV>, val textNorm: String? = null, val confidence: Double,
) { init { requirePolygon(polygon); requireUnit(confidence, "confidence"); requireLen(label, 1, 200, "label") } }

@Serializable @SerialName("layout")
data class Layout(
    override val id: String, override val ts: Long,
    val fingerprint: String, val screenType: ScreenType, val rotation: Int, val language: String,
    val sensitivity: Sensitivity, val screenQuad: List<Point>? = null, val elements: List<LayoutElement>, val source: LayoutSource,
) : ServerMessage() {
    init { require(rotation in setOf(0, 90, 180, 270)) { "rotation must be 0/90/180/270" }; requireQuad(screenQuad); require(elements.size <= 200) }
}
@Serializable enum class LayoutSource { @SerialName("memory") MEMORY, @SerialName("model") MODEL }

@Serializable @SerialName("target")
data class Target(override val id: String, override val ts: Long, val elementId: String, val polygon: List<UV>, val confidence: Double, val say: String) : ServerMessage() {
    init { requirePolygon(polygon); requireUnit(confidence, "confidence") }
}

@Serializable @SerialName("say")
data class Say(override val id: String, override val ts: Long, val text: String, val priority: Priority) : ServerMessage()

@Serializable @SerialName("ask")
data class Ask(override val id: String, override val ts: Long, val question: String, val options: List<String>) : ServerMessage() {
    init { require(options.size <= 8) }
}

@Serializable data class Amount(val value: Double, val currency: String) {
    init { require(value >= 0); require(Regex("^[A-Z]{3}$").matches(currency)) { "currency must be ISO 4217" } }
}

@Serializable @SerialName("confirm")
data class Confirm(override val id: String, override val ts: Long, val summary: String, val amount: Amount? = null) : ServerMessage()

@Serializable @SerialName("expect")
data class Expect(override val id: String, override val ts: Long, val description: String) : ServerMessage()

@Serializable enum class VerifyOutcome { @SerialName("ok") OK, @SerialName("wrong") WRONG, @SerialName("nochange") NOCHANGE }

@Serializable @SerialName("verify")
data class Verify(override val id: String, override val ts: Long, val re: String, val result: VerifyOutcome, val actualElementId: String? = null, val say: String) : ServerMessage()

@Serializable @SerialName("mode")
data class Mode(override val id: String, override val ts: Long, val mode: SessionMode, val reason: String) : ServerMessage()

@Serializable @SerialName("quota")
data class Quota(override val id: String, override val ts: Long, val tasksLeft: Int) : ServerMessage()

@Serializable enum class FinishResult { @SerialName("done") DONE, @SerialName("aborted") ABORTED, @SerialName("failed") FAILED }

@Serializable @SerialName("finish")
data class Finish(override val id: String, override val ts: Long, val result: FinishResult, val say: String) : ServerMessage()

@Serializable @SerialName("error")
data class ErrorMessage(override val id: String, override val ts: Long, val code: ErrorCode, val retryable: Boolean, val say: String) : ServerMessage()

@Serializable @SerialName("sim.touch")
data class SimTouch(
    override val id: String, override val ts: Long,
    val runId: String, val screenId: String, val x: Double, val y: Double, val u: Double, val v: Double, val elementId: String?,
) : ServerMessage() { init { requireUnit(u, "u"); requireUnit(v, "v") } }
