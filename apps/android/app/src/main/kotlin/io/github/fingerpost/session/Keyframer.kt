package io.github.fingerpost.session

import android.graphics.Bitmap
import io.github.fingerpost.guidance.KeyframeTokens
import io.github.fingerpost.guidance.OcrToken
import io.github.fingerpost.guidance.Vec2
import io.github.fingerpost.protocol.Box
import io.github.fingerpost.protocol.ImageSize
import io.github.fingerpost.protocol.KeyframeHeader
import io.github.fingerpost.protocol.KeyframeKind
import io.github.fingerpost.protocol.KeyframePurpose
import io.github.fingerpost.protocol.Limits
import io.github.fingerpost.protocol.Point
import io.github.fingerpost.safety.UploadGuard
import io.github.fingerpost.vision.FaceCover
import java.io.ByteArrayOutputStream
import org.opencv.android.Utils
import org.opencv.core.Mat
import org.opencv.core.MatOfPoint2f
import org.opencv.core.Size
import org.opencv.imgproc.Imgproc
import io.github.fingerpost.protocol.OcrToken as WireToken

class EncodedKeyframe(val header: KeyframeHeader, val jpeg: ByteArray)

/**
 * design §4.2: a `full` keyframe is the face-covered frame at 1024 px wide; a `screen` keyframe is the quad
 * rectified to a 1024-wide crop. Every frame goes through [guard] first; null means it must not be uploaded.
 */
class Keyframer(private val guard: UploadGuard, private val faces: FaceCover) {
    /**
     * [upright] is the frame the [tokens] and [quadPx] refer to (tokens frame-normalized, quad in its pixels).
     * [tokens] must be OCR of this very frame; null (OCR failed) blocks it. Blocking: call off the UI thread.
     */
    fun encode(upright: Bitmap, quadPx: List<Vec2>?, kind: KeyframeKind, purpose: KeyframePurpose,
               tokens: List<OcrToken>?, nowMs: Long, gateTokens: List<OcrToken>? = tokens): EncodedKeyframe? {
        if (tokens == null || !guard.mayUpload(gateTokens, nowMs)) return null
        return if (kind == KeyframeKind.SCREEN && quadPx != null) screen(upright, quadPx, purpose, tokens)
        else full(upright, quadPx, purpose, tokens)
    }

    private fun full(upright: Bitmap, quadPx: List<Vec2>?, purpose: KeyframePurpose, tokens: List<OcrToken>): EncodedKeyframe {
        val scale = WIDTH.toFloat() / upright.width
        val scaled = Bitmap.createScaledBitmap(upright, WIDTH, (upright.height * scale).toInt().coerceAtLeast(1), true)
        val covered = faces.cover(scaled)
        if (scaled !== upright) scaled.recycle()
        val jpeg = try { jpeg(covered) } catch (e: RuntimeException) { covered.recycle(); throw e }
        val header = KeyframeHeader(newId(), nowMs(), KeyframeKind.FULL,
            quadPx?.map { Point(it.x * scale, it.y * scale) }, ImageSize(covered.width, covered.height),
            wire(KeyframeTokens.forFull(tokens)), purpose)
        covered.recycle()
        return EncodedKeyframe(header, jpeg)
    }

    private fun screen(upright: Bitmap, quadPx: List<Vec2>, purpose: KeyframePurpose, tokens: List<OcrToken>): EncodedKeyframe {
        val (tl, tr, br, bl) = quadPx
        val quadW = (dist(tl, tr) + dist(bl, br)) / 2
        val quadH = (dist(tl, bl) + dist(tr, br)) / 2
        val height = (WIDTH * quadH / quadW).toInt().coerceIn(1, 4096)
        val src = Mat()
        Utils.bitmapToMat(upright, src)
        val from = MatOfPoint2f(*quadPx.map { org.opencv.core.Point(it.x, it.y) }.toTypedArray())
        val to = MatOfPoint2f(org.opencv.core.Point(0.0, 0.0), org.opencv.core.Point(WIDTH.toDouble(), 0.0),
            org.opencv.core.Point(WIDTH.toDouble(), height.toDouble()), org.opencv.core.Point(0.0, height.toDouble()))
        val m = Imgproc.getPerspectiveTransform(from, to)
        val dst = Mat()
        Imgproc.warpPerspective(src, dst, m, Size(WIDTH.toDouble(), height.toDouble()))
        val crop = Bitmap.createBitmap(WIDTH, height, Bitmap.Config.ARGB_8888)
        Utils.matToBitmap(dst, crop)
        listOf(src, from, to, m, dst).forEach { it.release() }
        val jpeg = try { jpeg(crop) } finally { crop.recycle() }
        val quadNorm = quadPx.map { Vec2(it.x / upright.width, it.y / upright.height) }
        val header = KeyframeHeader(newId(), nowMs(), KeyframeKind.SCREEN, null, ImageSize(WIDTH, height),
            wire(KeyframeTokens.forScreen(tokens, quadNorm)), purpose)
        return EncodedKeyframe(header, jpeg)
    }

    private fun jpeg(bitmap: Bitmap): ByteArray {
        for (quality in intArrayOf(80, 65, 50)) {
            val out = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out)
            if (out.size() <= Limits.KEYFRAME_BYTES) return out.toByteArray()
        }
        error("Keyframe exceeds the protocol size limit")
    }

    private fun wire(tokens: List<OcrToken>) = tokens.map { WireToken(it.text, Box(it.u, it.v, it.w, it.h)) }

    private fun dist(a: Vec2, b: Vec2) = kotlin.math.hypot(a.x - b.x, a.y - b.y)

    private companion object { const val WIDTH = 1024 }
}
