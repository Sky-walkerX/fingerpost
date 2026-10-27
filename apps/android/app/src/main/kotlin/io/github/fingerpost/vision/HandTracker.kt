package io.github.fingerpost.vision

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
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
import io.github.fingerpost.guidance.FrameTransform
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class FingerSample(
    val tipX: Float, val tipY: Float, val dipX: Float, val dipY: Float,
    val presence: Float, val frameW: Int, val frameH: Int,
    val frameTsMs: Long, val inferenceMs: Long,
)

data class TrackingPerformance(val fps: Int = 0, val inferenceMs: Long = 0)

/** All GPU operations share one thread; one in-flight frame bounds bitmap/native memory. */
class HandTracker(context: Context) {
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
    private var delegate = Delegate.GPU
    private var generation = 0
    private var lastTimestamp = -1L
    private var pending: PendingFrame? = null
    private var modelInput: ModelInput? = null
    private val results = ArrayDeque<Pair<Long, Long>>()
    private var lastLogMs = 0L

    private data class PendingFrame(
        val width: Int, val height: Int,
        val transform: FrameTransform, val timestamp: Long, val startedMs: Long,
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
            .setNumHands(2)
            .setMinHandDetectionConfidence(0.5f)
            .setMinHandPresenceConfidence(0.5f)
            .setMinTrackingConfidence(0.5f)
            .setResultListener { result, _ ->
                dispatch { if (token == generation) onResult(result) }
            }
            .setErrorListener {
                dispatch { if (token == generation) fallbackToCpu() }
            }
            .build()
        return HandLandmarker.createFromOptions(appContext, options)
    }

    /** Takes ownership even when dropping a frame. No camera bitmap leaves the device. */
    fun submit(upright: Bitmap, tsMs: Long) {
        synchronized(dispatchLock) {
            if (closed.get() || !busy.compareAndSet(false, true)) {
                upright.recycle()
                return
            }
            executor.execute {
                try {
                    val tracker = landmarker
                    if (closed.get() || tracker == null) {
                        busy.set(false)
                        return@execute
                    }
                    val transform = FrameTransform.fitCenter(upright.width, upright.height, MODEL_WIDTH, MODEL_HEIGHT)
                    val input = modelInput ?: ModelInput().also { modelInput = it }
                    // The single in-flight gate prevents mutation while MediaPipe still reads it.
                    input.canvas.apply {
                        drawColor(Color.BLACK)
                        drawBitmap(upright, null, RectF(transform.offsetX, transform.offsetY,
                            transform.offsetX + upright.width * transform.scale,
                            transform.offsetY + upright.height * transform.scale), paint)
                    }
                    val timestamp = maxOf(tsMs, lastTimestamp + 1)
                    lastTimestamp = timestamp
                    pending = PendingFrame(upright.width, upright.height, transform, timestamp,
                        SystemClock.elapsedRealtime())
                    tracker.detectAsync(input.image, timestamp)
                } catch (_: RuntimeException) {
                    fallbackToCpu()
                } finally {
                    upright.recycle()
                }
            }
        }
    }

    private fun dispatch(action: () -> Unit) = synchronized(dispatchLock) {
        if (!closed.get()) executor.execute(action)
    }

    fun isReady(): Boolean = !closed.get() && !busy.get() && !mutableUnavailable.value

    private fun onResult(result: HandLandmarkerResult) {
        val frame = pending ?: return
        if (result.timestampMs() != frame.timestamp || closed.get()) return
        val now = SystemClock.elapsedRealtime()
        val inferenceMs = now - frame.startedMs
        mutableSamples.value = result.landmarks().mapIndexed { index, landmarks ->
            val tip = frame.transform.unmap(landmarks[8].x() * MODEL_WIDTH, landmarks[8].y() * MODEL_HEIGHT)
            val dip = frame.transform.unmap(landmarks[7].x() * MODEL_WIDTH, landmarks[7].y() * MODEL_HEIGHT)
            FingerSample(tip.x, tip.y, dip.x, dip.y, result.handedness()[index][0].score(),
                frame.width, frame.height, frame.timestamp, inferenceMs)
        }
        results.addLast(now to inferenceMs)
        while (results.isNotEmpty() && results.first().first <= now - 1_000) results.removeFirst()
        mutablePerformance.value = TrackingPerformance(results.size, inferenceMs)
        if (BuildConfig.DEBUG && now - lastLogMs >= 1_000) {
            Log.i(TAG, "delegate=$delegate fps=${results.size} inferenceMs=$inferenceMs " +
                "maxMs=${results.maxOf { it.second }} hands=${mutableSamples.value.size}")
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
            mutablePerformance.value = TrackingPerformance()
            executor.shutdown()
        }
    }

    companion object {
        private const val TAG = "FingerpostTracker"
        private const val MODEL_WIDTH = 640
        private const val MODEL_HEIGHT = 480
    }
}
