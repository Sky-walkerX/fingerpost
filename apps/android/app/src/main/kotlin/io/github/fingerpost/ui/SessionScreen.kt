package io.github.fingerpost.ui

import android.view.View
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.fingerpost.BuildConfig
import io.github.fingerpost.R
import io.github.fingerpost.camera.CameraPipeline
import io.github.fingerpost.guidance.FrameTransform
import io.github.fingerpost.vision.HandTracker
import java.util.Locale

@Composable
fun SessionScreen(onToggle: () -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val description = stringResource(R.string.session_description)
    val cameraError = stringResource(R.string.camera_unavailable)
    val trackingError = stringResource(R.string.tracking_unavailable)
    val previewView = remember(context) {
        PreviewView(context).apply {
            scaleType = PreviewView.ScaleType.FILL_CENTER
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            isClickable = false
            isFocusable = false
        }
    }
    var tracker by remember { mutableStateOf<HandTracker?>(null) }
    var cameraUnavailable by remember { mutableStateOf(false) }

    DisposableEffect(previewView, lifecycleOwner) {
        var pipeline: CameraPipeline? = null
        fun stop() {
            pipeline?.close()
            pipeline = null
            tracker?.close()
            tracker = null
        }
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> {
                    cameraUnavailable = false
                    val handTracker = HandTracker(context)
                    tracker = handTracker
                    pipeline = CameraPipeline(context, lifecycleOwner, previewView, handTracker::submit,
                        onError = { cameraUnavailable = true },
                        shouldAnalyze = handTracker::isReady).also { it.start() }
                }
                Lifecycle.Event.ON_STOP -> stop()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            stop()
        }
    }

    val currentTracker = tracker
    val unavailable = currentTracker?.unavailable?.collectAsStateWithLifecycle()?.value ?: false
    val error = if (cameraUnavailable) cameraError else if (unavailable) trackingError else null
    Box(Modifier.fillMaxSize().background(Color.Black).clickable(onClick = onToggle)
        .clearAndSetSemantics {
            contentDescription = error ?: description
            onClick { onToggle(); true }
        }) {
        AndroidView(factory = { previewView }, modifier = Modifier.fillMaxSize())
        if (currentTracker != null) {
            val samples by currentTracker.samples.collectAsStateWithLifecycle()
            val performance by currentTracker.performance.collectAsStateWithLifecycle()
            Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
                if (size.width > 0 && size.height > 0) {
                    for (sample in samples) {
                        val transform = FrameTransform.fillCenter(sample.frameW, sample.frameH,
                            size.width.toInt(), size.height.toInt())
                        val point = transform.map(sample.tipX, sample.tipY)
                        drawCircle(Color.Yellow, radius = 7.dp.toPx(), center = Offset(point.x, point.y))
                    }
                }
            }
            if (BuildConfig.DEBUG) {
                Text(String.format(Locale.ROOT, "%d fps · %d ms", performance.fps, performance.inferenceMs),
                    color = Color.Yellow, modifier = Modifier.safeDrawingPadding().padding(16.dp)
                        .background(Color.Black).clearAndSetSemantics {})
            }
        }
        if (error != null) {
            Text(error, color = Color.White, modifier = Modifier.safeDrawingPadding().padding(16.dp)
                .background(Color.Black).clearAndSetSemantics {})
        }
    }
}
