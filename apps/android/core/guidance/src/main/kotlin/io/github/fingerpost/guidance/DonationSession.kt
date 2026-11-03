package io.github.fingerpost.guidance

const val DONATION_CONSENT_VERSION = "donate.v1"

data class DonationPose(val offsetMs: Long, val quad: List<Vec2>?, val finger: Vec2?)
data class DonationFrame(val jpeg: ByteArray, val pose: DonationPose)
data class DonationPacket(val outcome: String, val frames: List<DonationFrame>)
data class NumberMask(val x: Double, val y: Double, val width: Double, val height: Double)

/** Mask every number-bearing OCR word, including fragmented/Unicode card sequences. Keep no recognized text. */
fun donationNumberMasks(tokens: List<OcrToken>): List<NumberMask> = tokens.filter { it.text.any(Char::isDigit) }.map {
    require(listOf(it.u,it.v,it.w,it.h).all(Double::isFinite) && it.u >= 0 && it.v >= 0 &&
        it.w > 0 && it.h > 0 && it.u + it.w <= 1.0 && it.v + it.h <= 1.0)
    NumberMask(it.u,it.v,it.w,it.h)
}

/** Memory only. A task's PIN/private protection invalidates earlier captures and any pending consent. */
class DonationSession {
    @Volatile var ticket = 0L; private set
    @Volatile var collecting = false; private set
    @Volatile var awaitingConsent = false; private set
    @Volatile var uploadAllowed = false; private set
    private var outcome: String? = null
    private val frames = ArrayList<DonationFrame>()
    @Synchronized fun begin(enabled: Boolean): Long { clear(); collecting = enabled; return ticket }
    @Synchronized fun record(jpeg: ByteArray, pose: DonationPose, forTicket: Long = ticket) {
        fun valid(p: Vec2) = p.x.isFinite() && p.y.isFinite() && p.x in 0.0..1.0 && p.y in 0.0..1.0
        if (!collecting || ticket != forTicket || jpeg.size !in 1..409_600 || pose.offsetMs < 0 ||
            (pose.quad != null && (pose.quad.size != 4 || !pose.quad.all(::valid))) ||
            (pose.finger != null && !valid(pose.finger))) { jpeg.fill(0); return }
        if (frames.size == 20) frames.removeAt(0).jpeg.fill(0)
        frames += DonationFrame(jpeg,pose)
    }
    @Synchronized fun offer(result: String): Boolean {
        if (!collecting || frames.isEmpty() || result !in setOf("failed","wrong","nochange")) return false
        collecting = false; awaitingConsent = true; outcome = result
        return true
    }
    @Synchronized fun accept(answer: Boolean?): DonationPacket? {
        if (!awaitingConsent) return null
        if (answer != true) { clear(); return null }
        awaitingConsent = false; uploadAllowed = true
        return DonationPacket(requireNotNull(outcome), frames.toList())
    }
    @Synchronized fun protect() = clear()
    @Synchronized fun clear() {
        ticket++; collecting = false; awaitingConsent = false; uploadAllowed = false; outcome = null
        frames.forEach { it.jpeg.fill(0) }; frames.clear()
    }
}

/** Consent is one explicit yes/no word; mixed or qualified answers never authorize an upload. */
fun donationConsent(text: String): Boolean? = text.trim().trimEnd('.', '!', '?', '।').takeIf {
    it.isNotEmpty() && it.none(Char::isWhitespace) && ',' !in it
}?.let { YesNo.parse(it) }
