package io.github.fingerpost.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

const val PROTOCOL = "fp.v1"

object Limits {
    const val TEXT_BYTES = 16_384
    const val HEADER_BYTES = 16_384
    const val KEYFRAME_BYTES = 409_600
}

internal fun requireUnit(v: Double, name: String) = require(v in 0.0..1.0) { "$name must be in [0,1], was $v" }
internal fun requireLen(s: String, min: Int, max: Int, name: String) = require(s.length in min..max) { "$name length must be $min..$max" }

@Serializable data class Point(val x: Double, val y: Double)

@Serializable data class UV(val u: Double, val v: Double) {
    init { requireUnit(u, "u"); requireUnit(v, "v") }
}

@Serializable data class Box(val u: Double, val v: Double, val w: Double, val h: Double) {
    init { requireUnit(u, "u"); requireUnit(v, "v"); requireUnit(w, "w"); requireUnit(h, "h") }
}

internal fun requirePolygon(p: List<UV>) = require(p.size in 3..32) { "polygon must have 3..32 points, had ${p.size}" }
internal fun requireQuad(q: List<Point>?) = require(q == null || q.size == 4) { "quad must have 4 points" }

@Serializable enum class Locale { @SerialName("en") EN, @SerialName("hi") HI, @SerialName("es") ES }
@Serializable enum class Priority { @SerialName("safety") SAFETY, @SerialName("state") STATE, @SerialName("guide") GUIDE, @SerialName("info") INFO }

@Serializable enum class ElementRole {
    @SerialName("button") BUTTON, @SerialName("pay") PAY, @SerialName("confirm") CONFIRM, @SerialName("submit") SUBMIT,
    @SerialName("back") BACK, @SerialName("cancel") CANCEL, @SerialName("input") INPUT, @SerialName("text") TEXT,
    @SerialName("icon") ICON, @SerialName("key") KEY;
    /** guidance-spec §11: the device refuses to guide to these without an accepted confirm. */
    val isIrreversible get() = this == PAY || this == CONFIRM || this == SUBMIT
}

@Serializable enum class ScreenType {
    @SerialName("menu") MENU, @SerialName("form") FORM, @SerialName("confirm") CONFIRM, @SerialName("payment_entry") PAYMENT_ENTRY,
    @SerialName("pin_pad") PIN_PAD, @SerialName("appliance") APPLIANCE, @SerialName("info") INFO, @SerialName("unknown") UNKNOWN
}

@Serializable enum class Sensitivity { @SerialName("none") NONE, @SerialName("financial") FINANCIAL, @SerialName("identity") IDENTITY }
@Serializable enum class RequestedMode { @SerialName("auto") AUTO, @SerialName("guide") GUIDE, @SerialName("task") TASK, @SerialName("explore") EXPLORE }
@Serializable enum class Intent { @SerialName("guide") GUIDE, @SerialName("task") TASK, @SerialName("explore") EXPLORE }
@Serializable enum class SessionMode { @SerialName("normal") NORMAL, @SerialName("pin") PIN, @SerialName("private") PRIVATE, @SerialName("offline") OFFLINE }

@Serializable enum class ErrorCode {
    @SerialName("auth_expired") AUTH_EXPIRED, @SerialName("quota_exhausted") QUOTA_EXHAUSTED, @SerialName("cloud_paused") CLOUD_PAUSED,
    @SerialName("rate_limited") RATE_LIMITED, @SerialName("model_unavailable") MODEL_UNAVAILABLE, @SerialName("bad_message") BAD_MESSAGE,
    @SerialName("version_unsupported") VERSION_UNSUPPORTED
}
