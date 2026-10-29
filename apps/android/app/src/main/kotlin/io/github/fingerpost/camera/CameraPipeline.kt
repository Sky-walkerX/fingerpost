package io.github.fingerpost.camera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.Rect
import android.hardware.display.DisplayManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.util.Size
import android.view.Surface
import android.view.View
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.core.UseCaseGroup
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import io.github.fingerpost.BuildConfig
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** Owns its use cases only. The receiver owns each upright bitmap passed to onFrame. */
class CameraPipeline(
    context: Context,
    private val lifecycleOwner: LifecycleOwner,
    private val previewView: PreviewView,
    private val onFrame: (upright: Bitmap, tsMs: Long) -> Unit,
    private val onError: () -> Unit = {},
    private val shouldAnalyze: () -> Boolean = { true },
    private val onAnalysisFrame: ((AnalysisFrame) -> Unit)? = null,
) {
    private val appContext = context.applicationContext
    private val mainExecutor = ContextCompat.getMainExecutor(appContext)
    private val executor = Executors.newSingleThreadExecutor()
    private val running = AtomicBoolean(false)
    private val displayManager = appContext.getSystemService(DisplayManager::class.java)
    private var provider: ProcessCameraProvider? = null
    private var preview: Preview? = null
    private var analysis: ImageAnalysis? = null
    private var generation = 0
    private var closed = false
    private var windowStartMs = 0L
    private var received = 0
    private var converted = 0
    private var conversionMaxNs = 0L
    private var rotationMaxNs = 0L

    private val layoutListener = View.OnLayoutChangeListener { _, left, top, right, bottom,
        oldLeft, oldTop, oldRight, oldBottom ->
        if (running.get() && right > left && bottom > top &&
            (right - left != oldRight - oldLeft || bottom - top != oldBottom - oldTop)) {
            stop()
            start()
        }
    }

    private val displayListener = object : DisplayManager.DisplayListener {
        override fun onDisplayAdded(displayId: Int) = Unit
        override fun onDisplayRemoved(displayId: Int) = Unit
        override fun onDisplayChanged(displayId: Int) {
            if (previewView.display?.displayId == displayId) updateRotation()
        }
    }

    fun start() {
        check(Looper.myLooper() == Looper.getMainLooper())
        if (closed || !running.compareAndSet(false, true)) return
        val token = ++generation
        displayManager.registerDisplayListener(displayListener, Handler(Looper.getMainLooper()))
        previewView.addOnLayoutChangeListener(layoutListener)
        previewView.post {
            if (!running.get() || token != generation) return@post
            val future = ProcessCameraProvider.getInstance(appContext)
            future.addListener({
                if (!running.get() || token != generation) return@addListener
                try {
                    val cameraProvider = future.get()
                    val selector = ResolutionSelector.Builder()
                        .setAspectRatioStrategy(AspectRatioStrategy.RATIO_16_9_FALLBACK_AUTO_STRATEGY)
                        .setResolutionStrategy(ResolutionStrategy(
                            Size(1280, 720),
                            ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
                        )).build()
                    val rotation = previewView.display?.rotation ?: Surface.ROTATION_0
                    val cameraPreview = Preview.Builder().setResolutionSelector(selector)
                        .setTargetRotation(rotation).build()
                    val cameraAnalysis = ImageAnalysis.Builder().setResolutionSelector(selector)
                        .setTargetRotation(rotation)
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                        .build()
                    cameraPreview.setSurfaceProvider(previewView.surfaceProvider)
                    cameraAnalysis.setAnalyzer(executor) { proxy ->
                        val arrivedNs = SystemClock.elapsedRealtimeNanos()
                        if (windowStartMs == 0L) windowStartMs = arrivedNs / 1_000_000
                        received++
                        var source: Bitmap? = null
                        var upright: Bitmap? = null
                        try {
                            if (running.get() && shouldAnalyze()) {
                                source = proxy.toBitmap()
                                val convertedNs = SystemClock.elapsedRealtimeNanos()
                                val crop = proxy.cropRect
                                conversionMaxNs = maxOf(conversionMaxNs, convertedNs - arrivedNs)
                                converted++
                                val rawReceiver = onAnalysisFrame
                                if (rawReceiver != null) {
                                    rawReceiver(AnalysisFrame(source, Rect(crop), proxy.imageInfo.rotationDegrees,
                                        proxy.imageInfo.timestamp / 1_000_000))
                                    source = null
                                } else {
                                    val matrix = Matrix().apply { postRotate(proxy.imageInfo.rotationDegrees.toFloat()) }
                                    upright = Bitmap.createBitmap(source, crop.left, crop.top, crop.width(), crop.height(), matrix, true)
                                    rotationMaxNs = maxOf(rotationMaxNs, SystemClock.elapsedRealtimeNanos() - convertedNs)
                                    if (source !== upright) source.recycle()
                                    source = null
                                    onFrame(upright, proxy.imageInfo.timestamp / 1_000_000)
                                    upright = null
                                }
                            }
                        } catch (_: RuntimeException) {
                            mainExecutor.execute {
                                if (running.get()) {
                                    stop()
                                    onError()
                                }
                            }
                        } finally {
                            upright?.recycle()
                            source?.takeUnless { it.isRecycled }?.recycle()
                            proxy.close()
                            val nowMs = SystemClock.elapsedRealtime()
                            if (BuildConfig.DEBUG && nowMs - windowStartMs >= 1_000) {
                                Log.i("FingerpostCamera", "windowMs=${nowMs - windowStartMs} received=$received converted=$converted " +
                                    "conversionMaxMs=${conversionMaxNs / 1_000_000} rotationMaxMs=${rotationMaxNs / 1_000_000}")
                                windowStartMs = nowMs
                                received = 0
                                converted = 0
                                conversionMaxNs = 0
                                rotationMaxNs = 0
                            }
                        }
                    }
                    provider = cameraProvider
                    preview = cameraPreview
                    analysis = cameraAnalysis
                    val group = UseCaseGroup.Builder().addUseCase(cameraPreview).addUseCase(cameraAnalysis)
                    previewView.viewPort?.let { group.setViewPort(it) }
                    if (ContextCompat.checkSelfPermission(appContext, Manifest.permission.CAMERA) !=
                        PackageManager.PERMISSION_GRANTED) {
                        stop()
                        onError()
                        return@addListener
                    }
                    cameraProvider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, group.build())
                } catch (_: Exception) {
                    stop()
                    onError()
                }
            }, mainExecutor)
        }
    }

    private fun updateRotation() {
        val rotation = previewView.display?.rotation ?: return
        preview?.targetRotation = rotation
        analysis?.targetRotation = rotation
    }

    fun stop() {
        check(Looper.myLooper() == Looper.getMainLooper())
        running.set(false)
        generation++
        displayManager.unregisterDisplayListener(displayListener)
        previewView.removeOnLayoutChangeListener(layoutListener)
        analysis?.clearAnalyzer()
        val useCases = listOfNotNull(preview, analysis).toTypedArray()
        if (useCases.isNotEmpty()) provider?.unbind(*useCases)
        preview = null
        analysis = null
    }

    fun close(onDrained: () -> Unit = {}) {
        stop()
        closed = true
        executor.execute(onDrained)
        executor.shutdown()
    }
}
