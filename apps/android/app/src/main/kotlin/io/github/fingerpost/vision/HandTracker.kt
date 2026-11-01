package io.github.fingerpost.vision

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Matrix
import android.os.SystemClock
import android.util.Log
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult
import io.github.fingerpost.BuildConfig
import io.github.fingerpost.camera.AnalysisFrame
import io.github.fingerpost.guidance.AnalysisFrameTransform
import io.github.fingerpost.guidance.FrameTransform
import io.github.fingerpost.guidance.Bbox
import io.github.fingerpost.guidance.HandSample
import io.github.fingerpost.guidance.ThrottlePolicy
import io.github.fingerpost.guidance.Vec2
import android.os.PowerManager
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class FingerSample(
    val tipX: Float, val tipY: Float, val dipX: Float, val dipY: Float,
    val presence: Float, val frameW: Int, val frameH: Int,
    val frameTsMs: Long, val inferenceMs: Long,
    val handBox: Bbox? = null,
)

data class TrackingPerformance(val fps: Int = 0, val inferenceMs: Long = 0)

/** All GPU operations share one thread; one in-flight frame bounds bitmap/native memory. */
class HandTracker(context: Context, private val options: TrackingOptions = TrackingOptions()) {
    private val appContext = context.applicationContext
    private val executor = Executors.newSingleThreadExecutor()
    private val dispatchLock = Any()
    private val busy = AtomicBoolean(true)
    private val closed = AtomicBoolean(false)
    private val paint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val mutableSamples = MutableStateFlow<List<FingerSample>>(emptyList())
    val samples: StateFlow<List<FingerSample>> = mutableSamples.asStateFlow()
    private val mutablePerformance = MutableStateFlow(TrackingPerformance())
    val performance: StateFlow<TrackingPerformance> = mutablePerformance.asStateFlow()
    private val mutableUnavailable = MutableStateFlow(false)
    val unavailable: StateFlow<Boolean> = mutableUnavailable.asStateFlow()
    private var landmarker: HandLandmarker? = null
    private var delegate = options.delegate
    private var generation = 0
    private var lastTimestamp = -1L
    private var pending: PendingFrame? = null
    private var modelInput: ModelInput? = null
    private val results = ArrayDeque<Pair<Long, Long>>()
    private var lastLogMs = 0L
    private val powerManager: PowerManager? = appContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
    internal var thermalStatusProvider: () -> Int = { powerManager?.currentThermalStatus ?: 0 }
    private var frameCount = 0L
    private var prevSamples: List<FingerSample> = emptyList()
    private var lastSamples: List<FingerSample> = emptyList()

    private data class PendingFrame(
        val width: Int, val height: Int,
        val transform: FrameTransform, val timestamp: Long, val startedNs: Long,
        val prepareNs: Long, var submitNs: Long = 0,
    )

    private class ModelInput {
        val bitmap: Bitmap = Bitmap.createBitmap(MODEL_WIDTH, MODEL_HEIGHT, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val image: MPImage = BitmapImageBuilder(bitmap).build()
    }

    init {
        executor.execute {
            try {
                landmarker = createLandmarker()
                busy.set(false)
            } catch (_: RuntimeException) {
                fallbackToCpu()
            }
        }
    }

    private fun createLandmarker(): HandLandmarker {
        val token = ++generation
        val options = HandLandmarker.HandLandmarkerOptions.builder()
            .setBaseOptions(BaseOptions.builder().setModelAssetPath("hand_landmarker.task")
                .setDelegate(delegate).build())
            .setRunningMode(RunningMode.LIVE_STREAM)
            .setNumHands(options.maxHands)
            .setMinHandDetectionConfidence(0.5f)
            .setMinHandPresenceConfidence(0.5f)
            .setMinTrackingConfidence(0.5f)
            .setResultListener { result, outputImage ->
                val callbackNs = SystemClock.elapsedRealtimeNanos()
                // MediaPipe 1.1.1 creates a distinct bitmap for each callback and does not close it.
                try {
                    dispatch { if (token == generation) onResult(result, callbackNs) }
                } finally {
                    outputImage.close()
                }
            }
            .setErrorListener {
                dispatch { if (token == generation) fallbackToCpu() }
            }
            .build()
        return HandLandmarker.createFromOptions(appContext, options)
    }

    /** Takes ownership even when dropping a frame. No camera bitmap leaves the device. */
    fun submit(upright: Bitmap, tsMs: Long) {
        submit(AnalysisFrame(upright, Rect(0, 0, upright.width, upright.height), 0, tsMs))
    }

    /** Fuses crop, rotation and downscale without allocating a full-sized upright bitmap. */
    fun submit(frame: AnalysisFrame) {
        val bitmap = frame.bitmap
        synchronized(dispatchLock) {
            if (closed.get()) {
                bitmap.recycle()
                return
            }
            val thermalStatus = thermalStatusProvider()
            val recentInferenceMs = results.lastOrNull()?.second ?: 0L
            val stride = ThrottlePolicy.stride(thermalStatus, recentInferenceMs)
            val currentFrame = ++frameCount
            if (stride > 1 && (currentFrame % stride != 0L)) {
                bitmap.recycle()
                if (lastSamples.isNotEmpty()) {
                    if (frame.timestampMs - lastSamples.first().frameTsMs > 200L) {
                        lastSamples = emptyList()
                        prevSamples = emptyList()
                        mutableSamples.value = emptyList()
                    } else {
                        val interpolated = interpolateSamples(prevSamples, lastSamples, frame.timestampMs)
                        mutableSamples.value = interpolated
                    }
                }
                return
            }
            if (!busy.compareAndSet(false, true)) {
                bitmap.recycle()
                return
            }
            executor.execute {
                val prepareStartNs = SystemClock.elapsedRealtimeNanos()
                try {
                    val tracker = landmarker
                    if (closed.get() || tracker == null) {
                        busy.set(false)
                        return@execute
                    }
                    val crop = frame.crop
                    val geometry = AnalysisFrameTransform(crop.left, crop.top, crop.width(), crop.height(),
                        frame.rotationDegrees, MODEL_WIDTH, MODEL_HEIGHT)
                    val transform = geometry.letterbox
                    val input = modelInput ?: ModelInput().also { modelInput = it }
                    val source = floatArrayOf(crop.left.toFloat(), crop.top.toFloat(),
                        crop.right.toFloat(), crop.top.toFloat(), crop.left.toFloat(), crop.bottom.toFloat())
                    val destination = FloatArray(6)
                    for (index in 0..2) {
                        val point = geometry.rawToModel(source[index * 2], source[index * 2 + 1])
                        destination[index * 2] = point.x
                        destination[index * 2 + 1] = point.y
                    }
                    val matrix = Matrix()
                    check(matrix.setPolyToPoly(source, 0, destination, 0, 3))
                    // The single in-flight gate prevents mutation while MediaPipe still reads it.
                    input.canvas.apply {
                        drawColor(Color.BLACK)
                        val saved = save()
                        try {
                            clipRect(transform.offsetX, transform.offsetY,
                                transform.offsetX + geometry.uprightWidth * transform.scale,
                                transform.offsetY + geometry.uprightHeight * transform.scale)
                            drawBitmap(bitmap, matrix, paint)
                        } finally {
                            restoreToCount(saved)
                        }
                    }
                    val timestamp = maxOf(frame.timestampMs, lastTimestamp + 1)
                    lastTimestamp = timestamp
                    val startedNs = SystemClock.elapsedRealtimeNanos()
                    val pendingFrame = PendingFrame(geometry.uprightWidth, geometry.uprightHeight, transform, timestamp,
                        startedNs, startedNs - prepareStartNs)
                    pending = pendingFrame
                    tracker.detectAsync(input.image, timestamp)
                    pendingFrame.submitNs = SystemClock.elapsedRealtimeNanos() - startedNs
                } catch (_: RuntimeException) {
                    fallbackToCpu()
                } finally {
                    bitmap.recycle()
                }
            }
        }
    }

    private fun dispatch(action: () -> Unit) = synchronized(dispatchLock) {
        if (!closed.get()) executor.execute(action)
    }

    fun isReady(): Boolean = !closed.get() && !busy.get() && !mutableUnavailable.value

    private fun onResult(result: HandLandmarkerResult, callbackNs: Long) {
        val frame = pending ?: return
        if (result.timestampMs() != frame.timestamp || closed.get()) return
        val now = SystemClock.elapsedRealtime()
        val inferenceMs = (callbackNs - frame.startedNs) / 1_000_000
        val dispatchMs = (SystemClock.elapsedRealtimeNanos() - callbackNs) / 1_000_000
        val newSamples = result.landmarks().mapIndexed { index, landmarks ->
            val tip = frame.transform.unmap(landmarks[8].x() * MODEL_WIDTH, landmarks[8].y() * MODEL_HEIGHT)
            val dip = frame.transform.unmap(landmarks[7].x() * MODEL_WIDTH, landmarks[7].y() * MODEL_HEIGHT)
            val box = Bbox.of(landmarks.map { point ->
                val image = frame.transform.unmap(point.x() * MODEL_WIDTH, point.y() * MODEL_HEIGHT)
                Vec2(image.x.toDouble(), image.y.toDouble())
            })
            FingerSample(tip.x, tip.y, dip.x, dip.y, result.handedness()[index][0].score(),
                frame.width, frame.height, frame.timestamp, inferenceMs, box)
        }
        prevSamples = lastSamples
        lastSamples = newSamples
        mutableSamples.value = newSamples
        results.addLast(now to inferenceMs)
        while (results.isNotEmpty() && results.first().first <= now - 1_000) results.removeFirst()
        mutablePerformance.value = TrackingPerformance(results.size, inferenceMs)
        if (BuildConfig.DEBUG && now - lastLogMs >= 1_000) {
            Log.i(TAG, "delegate=$delegate maxHands=${options.maxHands} fps=${results.size} inferenceMs=$inferenceMs " +
                "maxMs=${results.maxOf { it.second }} hands=${mutableSamples.value.size} " +
                "prepareMs=${frame.prepareNs / 1_000_000} submitMs=${frame.submitNs / 1_000_000} callbackMs=$dispatchMs")
            lastLogMs = now
        }
        releasePending()
    }

    private fun releasePending() {
        pending = null
        busy.set(false)
    }

    private fun fallbackToCpu() {
        generation++
        landmarker?.close()
        landmarker = null
        modelInput?.image?.close()
        modelInput = null
        mutableSamples.value = emptyList()
        prevSamples = emptyList()
        lastSamples = emptyList()
        frameCount = 0L
        results.clear()
        mutablePerformance.value = TrackingPerformance()
        if (delegate == Delegate.GPU && !closed.get()) {
            delegate = Delegate.CPU
            Log.w(TAG, "GPU unavailable; using CPU")
            try {
                landmarker = createLandmarker()
            } catch (_: RuntimeException) {
                mutableUnavailable.value = true
            }
        } else {
            mutableUnavailable.value = true
        }
        releasePending()
    }

    fun close(): Unit = synchronized(dispatchLock) {
        if (!closed.compareAndSet(false, true)) return
        executor.execute {
            generation++
            landmarker?.close()
            landmarker = null
            modelInput?.image?.close()
            modelInput = null
            releasePending()
            mutableSamples.value = emptyList()
            prevSamples = emptyList()
            lastSamples = emptyList()
            frameCount = 0L
            mutablePerformance.value = TrackingPerformance()
            executor.shutdown()
        }
    }

    private fun interpolateSamples(
        prev: List<FingerSample>,
        curr: List<FingerSample>,
        targetTs: Long
    ): List<FingerSample> {
        return curr.mapIndexed { index, b ->
            val a = prev.getOrNull(index)
            if (a == null || a.frameTsMs == b.frameTsMs) {
                b.copy(frameTsMs = targetTs, inferenceMs = 0L)
            } else {
                val handA = HandSample(Vec2(a.tipX.toDouble(), a.tipY.toDouble()), Vec2(a.dipX.toDouble(), a.dipY.toDouble()), a.presence.toDouble())
                val handB = HandSample(Vec2(b.tipX.toDouble(), b.tipY.toDouble()), Vec2(b.dipX.toDouble(), b.dipY.toDouble()), b.presence.toDouble())
                val interpHand = ThrottlePolicy.interpolate(handA, handB, a.frameTsMs, b.frameTsMs, targetTs)
                val fraction = (targetTs - a.frameTsMs).toDouble() / (b.frameTsMs - a.frameTsMs).toDouble()
                val interpBox = if (a.handBox != null && b.handBox != null) {
                    ThrottlePolicy.interpolate(a.handBox, b.handBox, fraction)
                } else {
                    b.handBox
                }
                FingerSample(
                    tipX = interpHand.tip.x.toFloat(),
                    tipY = interpHand.tip.y.toFloat(),
                    dipX = interpHand.dip.x.toFloat(),
                    dipY = interpHand.dip.y.toFloat(),
                    presence = interpHand.presence.toFloat(),
                    frameW = b.frameW,
                    frameH = b.frameH,
                    frameTsMs = targetTs,
                    inferenceMs = 0L,
                    handBox = interpBox
                )
            }
        }
    }

    companion object {
        private const val TAG = "FingerpostTracker"
        private const val MODEL_WIDTH = 640
        private const val MODEL_HEIGHT = 480
    }
}
