package io.github.fingerpost.engine

import android.os.SystemClock
import io.github.fingerpost.BuildConfig
import io.github.fingerpost.camera.AnalysisFrame
import io.github.fingerpost.guidance.*
import io.github.fingerpost.protocol.KeyframeKind
import io.github.fingerpost.protocol.KeyframePurpose
import io.github.fingerpost.safety.UploadGuard
import io.github.fingerpost.session.EncodedKeyframe
import io.github.fingerpost.session.Keyframer
import io.github.fingerpost.vision.*
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import org.opencv.core.*
import org.opencv.imgproc.Imgproc

data class VisionFrame(
    val quad: List<Vec2>?, val width: Int, val height: Int, val stable: Boolean,
    val tracking: TrackState, val gray: FloatArray?, val handMask: BooleanArray?, val glare: Boolean,
    val anchorApplied: Boolean = false,
)

data class CaptureRequest(val purpose: KeyframePurpose, val generation: Long)
data class KeyframeCapture(val encoded: EncodedKeyframe, val quad: List<Vec2>?, val generation: Long)

/** Camera analysis owns the tracker; one separate worker owns OCR and encoding, with no bitmap backlog. */
class FrameRouter(
    private val hands: HandTracker,
    private val guard: UploadGuard,
    private val onFrame: (VisionFrame) -> Unit,
    private val onKeyframe: (KeyframeCapture) -> Unit,
    private val onError: () -> Unit,
) {
    private val tracker = ScreenTracker()
    private val estimator = QuadEstimator()
    private var stability = QuadStability()
    private val ocr = Ocr()
    private val faces = FaceCover()
    private val keyframer = Keyframer(guard, faces)
    private val capturePolicy = CapturePolicy()
    private val worker = Executors.newSingleThreadExecutor()
    private val busy = AtomicBoolean(false)
    private val closed = AtomicBoolean(false)
    private val request = AtomicReference<CaptureRequest?>()
    private data class Anchor(val quad: List<Vec2>, val captureQuad: List<Vec2>?)
    private val anchor = AtomicReference<Anchor?>()
    @Volatile var latestTokens: List<OcrToken>? = null; private set
    private var lastEstimate = Long.MIN_VALUE / 2
    private var lastOcr = Long.MIN_VALUE / 2
    private var dimensions: Pair<Int, Int>? = null

    fun requestKeyframe(purpose: KeyframePurpose, generation: Long) { request.set(CaptureRequest(purpose, generation)) }
    fun cancelKeyframes() { request.set(null) }

    /** Server corners are in the uploaded full image; carry them through the tracked motion since capture. */
    fun reanchor(quad: List<Vec2>, captureQuad: List<Vec2>?) { anchor.set(Anchor(quad, captureQuad)) }

    fun submit(frame: AnalysisFrame) {
        if (closed.get()) { frame.bitmap.recycle(); return }
        var transferred = false
        try {
            val bitmap = uprightBitmap(frame, 640, 360)
            try {
                val mats = FrameMats.of(bitmap)
                try {
                    val now = SystemClock.elapsedRealtime()
                    val width = bitmap.width
                    val height = bitmap.height
                    if (dimensions != width to height) {
                        tracker.reset()
                        stability = QuadStability()
                        dimensions = width to height
                        latestTokens = null
                        capturePolicy.reset()
                    }
                    fun pixels(q: List<Vec2>) = q.map { Vec2(it.x * width, it.y * height) }
                    val handBoxes = hands.samples.value.mapNotNull { sample ->
                        sample.handBox?.let { b -> Bbox(b.minX / sample.frameW * width, b.minY / sample.frameH * height,
                            b.maxX / sample.frameW * width, b.maxY / sample.frameH * height) }
                    }
                    val handBox = handBoxes.takeIf { it.isNotEmpty() }?.let { boxes ->
                        Bbox(boxes.minOf { it.minX }, boxes.minOf { it.minY }, boxes.maxOf { it.maxX }, boxes.maxOf { it.maxY })
                    }
                    tracker.update(mats.gray, handBox, now)
                    if (tracker.state == TrackState.LOST) capturePolicy.reset()
                    var anchorApplied = false
                    anchor.getAndSet(null)?.let { received ->
                        val motion = received.captureQuad?.let { captured ->
                            tracker.quad?.let { current -> Homography.fromPoints(captured, current) }
                        }
                        val moved = if (motion == null) pixels(received.quad)
                            else received.quad.mapNotNull(motion::map)
                        if (moved.size == 4 && Homography.imageToScreen(moved) != null) {
                            tracker.reanchor(moved)
                            capturePolicy.anchored()
                            anchorApplied = true
                        }
                    }
                    if (now - lastEstimate >= 100) {
                        lastEstimate = now
                        val points = latestTokens.orEmpty().flatMap { t -> listOf(Vec2(t.u * width, t.v * height),
                            Vec2((t.u + t.w) * width, (t.v + t.h) * height)) }
                        val estimate = estimator.estimate(mats, points)
                        val stable = stability.update(estimate, width, height)
                        if ((tracker.state == TrackState.NONE || tracker.state == TrackState.LOST) && stable && estimate != null)
                            tracker.reanchor(estimate)
                    }
                    val q = tracker.quad
                    val rectified = if (q != null && tracker.state == TrackState.TRACKING) rectify(mats.gray, q) else null
                    val mask = q?.let { handMask(mats.gray, it, handBoxes) }
                    val glare = q?.let { glare(mats.value, it) } ?: false
                    val normalized = q?.map { Vec2(it.x / width, it.y / height) }
                    onFrame(VisionFrame(normalized, width, height, stability.stable, tracker.state, rectified, mask, glare, anchorApplied))
                    if (now - lastOcr >= 200 && busy.compareAndSet(false, true)) {
                        lastOcr = now
                        val full = uprightBitmap(frame, 1024)
                        worker.execute {
                            try {
                                if (closed.get()) return@execute
                                val tokens = ocr.recognize(full)
                                latestTokens = tokens
                                val gateTokens = if (tokens == null || normalized == null || PinGate.check(tokens) != PinGateReason.NONE ||
                                    (guard.pinMode && PinGate.digitCount(tokens) >= 5)) tokens
                                    else KeyframeTokens.forScreen(tokens, normalized)
                                guard.observe(gateTokens, SystemClock.elapsedRealtime())
                                if (BuildConfig.DEBUG) android.util.Log.d("FingerpostOcr", "tokens=${tokens?.size ?: -1}")
                                val next = request.get()
                                if (next != null && !guard.pinMode && tokens != null) {
                                    val quadPx = normalized?.map { Vec2(it.x * full.width, it.y * full.height) }
                                    val purpose = if (next.purpose == KeyframePurpose.VERIFY) io.github.fingerpost.guidance.KeyframePurpose.VERIFY
                                        else io.github.fingerpost.guidance.KeyframePurpose.LOCATE
                                    val kind = if (capturePolicy.kind(quadPx != null, purpose) == CaptureKind.SCREEN) KeyframeKind.SCREEN else KeyframeKind.FULL
                                    val encoded = keyframer.encode(full, quadPx, kind, next.purpose, tokens,
                                        SystemClock.elapsedRealtime(), gateTokens)
                                    if (encoded != null && !closed.get() && request.compareAndSet(next, null))
                                        onKeyframe(KeyframeCapture(encoded, normalized, next.generation))
                                }
                            } catch (_: Exception) {
                                if (!closed.get()) onError()
                            } finally { full.recycle(); busy.set(false) }
                        }
                    }
                } finally { mats.release() }
            } finally { bitmap.recycle() }
            hands.submit(frame)
            transferred = true
        } catch (_: RuntimeException) {
            if (!closed.get()) onError()
        } finally {
            if (!transferred && !frame.bitmap.isRecycled) frame.bitmap.recycle()
        }
    }

    private fun transform(q: List<Vec2>): Mat {
        val from = MatOfPoint2f(*q.map { Point(it.x, it.y) }.toTypedArray())
        val to = MatOfPoint2f(Point(0.0, 0.0), Point(160.0, 0.0), Point(160.0, 90.0), Point(0.0, 90.0))
        return try { Imgproc.getPerspectiveTransform(from, to) } finally { from.release(); to.release() }
    }

    private fun rectify(gray: Mat, q: List<Vec2>): FloatArray {
        val matrix = transform(q)
        val out = Mat()
        return try {
            Imgproc.warpPerspective(gray, out, matrix, Size(160.0, 90.0))
            val bytes = ByteArray(160 * 90)
            out.get(0, 0, bytes)
            FloatArray(bytes.size) { (bytes[it].toInt() and 255) / 255f }
        } finally { matrix.release(); out.release() }
    }

    private fun handMask(gray: Mat, q: List<Vec2>, boxes: List<Bbox>): BooleanArray {
        val mask = Mat.zeros(gray.size(), CvType.CV_8UC1)
        val matrix = transform(q)
        val out = Mat()
        return try {
            boxes.forEach { b -> Imgproc.rectangle(mask, Point(b.minX, b.minY), Point(b.maxX, b.maxY), Scalar(255.0), -1) }
            Imgproc.warpPerspective(mask, out, matrix, Size(160.0, 90.0), Imgproc.INTER_NEAREST)
            val bytes = ByteArray(160 * 90)
            out.get(0, 0, bytes)
            BooleanArray(bytes.size) { bytes[it].toInt() != 0 }
        } finally { mask.release(); matrix.release(); out.release() }
    }

    private fun glare(value: Mat, q: List<Vec2>): Boolean {
        val inside = polygonMask(value, q)
        val bright = Mat()
        return try {
            Imgproc.threshold(value, bright, 0.98 * 255, 255.0, Imgproc.THRESH_BINARY)
            Core.bitwise_and(bright, inside, bright)
            val count = Core.countNonZero(inside)
            count > 0 && Core.countNonZero(bright).toDouble() / count > 0.08
        } finally { inside.release(); bright.release() }
    }

    /** Call after camera analysis has drained, so no native Mat is released while in use. */
    fun close() {
        if (!closed.compareAndSet(false, true)) return
        cancelKeyframes()
        tracker.reset()
        worker.execute { ocr.close(); faces.close(); latestTokens = null }
        worker.shutdown()
    }
}
