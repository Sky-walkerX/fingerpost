package io.github.fingerpost.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Messages the app sends. The JSON "type" field is the class discriminator. */
@Serializable sealed class ClientMessage { abstract val id: String; abstract val ts: Long }

@Serializable data class Caps(val simRunId: String? = null, val glasses: Boolean? = null)
@Serializable data class Resume(val sessionId: String, val digest: String)

@Serializable @SerialName("hello")
data class Hello(
    override val id: String, override val ts: Long,
    val appVersion: String, val protocol: String, val locale: Locale, val mode: RequestedMode,
    val privacy: Privacy, val caps: Caps, val resume: Resume? = null,
) : ClientMessage() {
    init { require(protocol == PROTOCOL) { "protocol must be $PROTOCOL" }; requireLen(appVersion, 1, 32, "appVersion") }
}
@Serializable enum class Privacy { @SerialName("normal") NORMAL, @SerialName("private") PRIVATE }

/** Binary frame header; payload = PCM16LE mono 16 kHz. */
@Serializable @SerialName("audio")
data class AudioHeader(override val id: String, override val ts: Long, val seq: Int, val sampleRate: Int = 16000) : ClientMessage() {
    init { require(seq >= 0); require(sampleRate == 16000) }
}

@Serializable @SerialName("audio.end") data class AudioEnd(override val id: String, override val ts: Long) : ClientMessage()

@Serializable @SerialName("goal")
data class Goal(override val id: String, override val ts: Long, val text: String, val source: GoalSource) : ClientMessage() {
    init { requireLen(text, 1, 500, "text") }
}
@Serializable enum class GoalSource { @SerialName("asr_device") ASR_DEVICE, @SerialName("typed") TYPED }

@Serializable data class OcrToken(val text: String, val box: Box) { init { requireLen(text, 1, 200, "ocr text") } }
@Serializable data class ImageSize(val w: Int, val h: Int) { init { require(w in 1..4096 && h in 1..4096) } }
@Serializable enum class KeyframeKind { @SerialName("full") FULL, @SerialName("screen") SCREEN }
@Serializable enum class KeyframePurpose { @SerialName("locate") LOCATE, @SerialName("verify") VERIFY, @SerialName("explore") EXPLORE }

/** Binary frame header; payload = JPEG. */
@Serializable @SerialName("keyframe")
data class KeyframeHeader(
    override val id: String, override val ts: Long,
    val kind: KeyframeKind, val quad: List<Point>? = null, val imageSize: ImageSize,
    val ocrTokens: List<OcrToken>, val purpose: KeyframePurpose,
) : ClientMessage() {
    init { requireQuad(quad); require(ocrTokens.size <= 400) }
}

@Serializable enum class EventKind {
    @SerialName("targetReached") TARGET_REACHED, @SerialName("tapDetected") TAP_DETECTED, @SerialName("screenChanged") SCREEN_CHANGED,
    @SerialName("lost") LOST, @SerialName("pinModeEntered") PIN_MODE_ENTERED, @SerialName("pinModeExited") PIN_MODE_EXITED,
    @SerialName("userCancel") USER_CANCEL
}
@Serializable enum class TapEvidence { @SerialName("sim") SIM, @SerialName("screen_change") SCREEN_CHANGE, @SerialName("dwell") DWELL }
@Serializable data class EventDetail(val evidence: TapEvidence)

@Serializable @SerialName("event")
data class ClientEvent(override val id: String, override val ts: Long, val kind: EventKind, val detail: EventDetail? = null) : ClientMessage() {
    init {
        if (kind == EventKind.TAP_DETECTED) require(detail != null) { "tapDetected requires detail.evidence" }
        else require(detail == null) { "$kind must not carry detail" }
    }
}

@Serializable @SerialName("answer")
data class Answer(override val id: String, override val ts: Long, val re: String, val text: String) : ClientMessage() {
    init { requireLen(text, 1, 500, "text") }
}

@Serializable @SerialName("confirm.reply")
data class ConfirmReply(override val id: String, override val ts: Long, val re: String, val accepted: Boolean, val utterance: String) : ClientMessage()

@Serializable @SerialName("abort") data class Abort(override val id: String, override val ts: Long, val reason: String? = null) : ClientMessage()
