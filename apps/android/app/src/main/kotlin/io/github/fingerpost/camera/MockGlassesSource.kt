package io.github.fingerpost.camera

import android.content.Context
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.media.MediaMetadataRetriever
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.SurfaceView
import io.github.fingerpost.BuildConfig
import io.github.fingerpost.guidance.ReplayTimeline
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/** Debug-only, local simulator MP4 replay. Audio is never decoded; normal upload/PIN gates still apply. */
class MockGlassesSource(
    private val file: File,
    private val preview: SurfaceView,
    private val onFrame: (AnalysisFrame) -> Unit,
    private val onError: () -> Unit,
) : FrameSource {
    private val worker = Executors.newSingleThreadScheduledExecutor()
    private val active = AtomicBoolean(false)
    private val closed = AtomicBoolean(false)
    private val generation = AtomicLong()
    private val main = Handler(Looper.getMainLooper())
    private var retriever: MediaMetadataRetriever? = null
    private var job: java.util.concurrent.ScheduledFuture<*>? = null
    override fun start() {
        check(BuildConfig.DEBUG)
        if (closed.get() || !active.compareAndSet(false, true)) return
        val token = generation.incrementAndGet()
        worker.execute {
            if (!active.get() || token != generation.get() || closed.get()) return@execute
            try {
                retriever?.release()
                val media = MediaMetadataRetriever().also { retriever = it; it.setDataSource(file.path) }
                val duration = requireNotNull(media.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull())
                val fps = media.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CAPTURE_FRAMERATE)?.toDoubleOrNull()
                    ?.takeIf { it.isFinite() && it in 1.0..60.0 } ?: 30.0
                val timeline = ReplayTimeline(duration, fps, SystemClock::elapsedRealtime).apply { start() }
                if (!active.get() || token != generation.get() || closed.get()) return@execute
                job = worker.scheduleWithFixedDelay({
                    if (!active.get() || token != generation.get() || closed.get()) return@scheduleWithFixedDelay
                    try {
                        val tick = timeline.next() ?: return@scheduleWithFixedDelay
                        val bitmap = requireNotNull(media.getScaledFrameAtTime(tick.positionUs,
                            MediaMetadataRetriever.OPTION_CLOSEST, 1280, 1280))
                        if (!active.get() || closed.get()) { bitmap.recycle(); return@scheduleWithFixedDelay }
                        try {
                            val holder = preview.holder
                            if (holder.surface.isValid) {
                                val canvas = holder.lockCanvas()
                                if (canvas != null) try {
                                    canvas.drawColor(Color.BLACK)
                                    val scale = maxOf(canvas.width.toFloat() / bitmap.width, canvas.height.toFloat() / bitmap.height)
                                    val w = bitmap.width * scale; val h = bitmap.height * scale
                                    canvas.drawBitmap(bitmap, null, RectF((canvas.width-w)/2, (canvas.height-h)/2,
                                        (canvas.width+w)/2, (canvas.height+h)/2), Paint(Paint.FILTER_BITMAP_FLAG))
                                } finally { holder.unlockCanvasAndPost(canvas) }
                            }
                            onFrame(AnalysisFrame(bitmap, Rect(0, 0, bitmap.width, bitmap.height), 0, tick.timestampMs))
                        } catch (error: Exception) { if (!bitmap.isRecycled) bitmap.recycle(); throw error }
                    } catch (_: Exception) { fail(token) }
                }, 0, (1000 / fps).toLong().coerceAtLeast(1), TimeUnit.MILLISECONDS)
            } catch (_: Exception) { fail(token) }
        }
    }
    private fun fail(token: Long) { if (token != generation.get()) return; active.set(false); job?.cancel(false); main.post { if (!closed.get()) onError() } }
    override fun stop() {
        active.set(false); generation.incrementAndGet(); job?.cancel(false)
        if (!worker.isShutdown) worker.execute { retriever?.release(); retriever = null; job = null }
    }
    override fun close(onDrained: () -> Unit) {
        if (!closed.compareAndSet(false, true)) return
        stop()
        worker.execute { try { retriever?.release(); retriever = null } finally { onDrained() } }
        worker.shutdown()
    }
    companion object {
        /** Fixed app-private path prevents an exported activity extra from reading arbitrary phone content. */
        fun selected(context: Context, enabled: Boolean): File? = if (BuildConfig.DEBUG && enabled)
            File(context.filesDir, "mock-glasses.mp4") else null
    }
}
