package io.github.fingerpost.ui

import android.Manifest
import android.view.View
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.fingerpost.BuildConfig
import io.github.fingerpost.R
import io.github.fingerpost.camera.CameraPipeline
import io.github.fingerpost.engine.GuidanceEngine
import io.github.fingerpost.guidance.FrameTransform
import io.github.fingerpost.guidance.GState
import io.github.fingerpost.vision.TrackingOptions
import java.util.Locale

@Composable
fun SessionScreen(onToggle: () -> Unit = {}, trackingOptions: TrackingOptions = TrackingOptions(), simRunId: String? = null) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val description = stringResource(R.string.session_description)
    val preview = remember(context) { PreviewView(context).apply {
        scaleType = PreviewView.ScaleType.FILL_CENTER
        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        isClickable = false; isFocusable = false
    } }
    var engine by remember { mutableStateOf<GuidanceEngine?>(null) }
    var cameraUnavailable by remember { mutableStateOf(false) }
    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        engine?.micPermissionResult(it)
    }
    DisposableEffect(preview, lifecycleOwner, trackingOptions, simRunId) {
        var pipeline: CameraPipeline? = null
        fun stop() {
            val previous = engine
            engine = null
            previous?.close()
            pipeline?.close { previous?.closeVision() }
            pipeline = null
        }
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> {
                    cameraUnavailable = false
                    val current = GuidanceEngine(context, trackingOptions, simRunId,
                        onMeteringPoint = { point, width, height -> pipeline?.meterAt(point, width, height) }) {
                        micPermission.launch(Manifest.permission.RECORD_AUDIO)
                    }
                    engine = current
                    pipeline = CameraPipeline(context, lifecycleOwner, preview,
                        onFrame = { bitmap, ts -> current.hands.submit(bitmap, ts) },
                        onError = { cameraUnavailable = true },
                        onAnalysisFrame = current::submit).also { it.start() }
                }
                Lifecycle.Event.ON_STOP -> stop()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer); stop() }
    }
    val current = engine
    val status = current?.status?.collectAsStateWithLifecycle()?.value ?: GuidanceEngine.Status()
    val samples = current?.hands?.samples?.collectAsStateWithLifecycle()?.value.orEmpty()
    val trackingUnavailable = current?.hands?.unavailable?.collectAsStateWithLifecycle()?.value == true
    val error = when {
        cameraUnavailable -> stringResource(R.string.camera_unavailable)
        trackingUnavailable -> stringResource(R.string.tracking_unavailable)
        else -> status.message
    }
    val label = when {
        status.cloudOff -> "Cloud off"
        !status.connected -> "Connecting"
        else -> when (status.state) {
            GState.IDLE -> "Ready"
            GState.LISTENING -> "Listening"
            GState.FRAMING -> "Frame the screen"
            GState.LOCATING -> "Finding the button"
            GState.GUIDING -> "Guiding"
            GState.ON_TARGET -> "On target"
            GState.VERIFYING -> "Checking the press"
            GState.DONE -> "Done"
        }
    }
    val toggleLabel = stringResource(if (status.state == GState.IDLE) R.string.start_session else R.string.stop_session)
    val toggle = { current?.toggle(); onToggle() }
    Box(Modifier.fillMaxSize().background(Color.Black).clickable(onClick = toggle).clearAndSetSemantics {
        contentDescription = error ?: description
        stateDescription = label
        onClick(label = toggleLabel) { toggle(); true }
    }) {
        AndroidView(factory = { preview }, modifier = Modifier.fillMaxSize())
        Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
            status.quad?.let { quad ->
                val path = Path()
                quad.forEachIndexed { i, p ->
                    val point = FrameTransform.fillCenter(status.frameWidth, status.frameHeight,
                        size.width.toInt().coerceAtLeast(1), size.height.toInt().coerceAtLeast(1))
                        .map((p.x * status.frameWidth).toFloat(), (p.y * status.frameHeight).toFloat())
                    val x = point.x
                    val y = point.y
                    if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
                }
                path.close()
                drawPath(path, if (status.tracking) Color.Green else Color.Yellow, style = Stroke(3.dp.toPx()))
            }
            for (sample in samples) {
                val transform = FrameTransform.fillCenter(sample.frameW, sample.frameH,
                    size.width.toInt().coerceAtLeast(1), size.height.toInt().coerceAtLeast(1))
                val point = transform.map(sample.tipX, sample.tipY)
                drawCircle(Color.Yellow, 7.dp.toPx(), Offset(point.x, point.y))
            }
        }
        Column(Modifier.safeDrawingPadding().padding(16.dp).background(Color.Black).clearAndSetSemantics {}) {
            Text(error ?: label, color = Color.White)
            if (BuildConfig.DEBUG && current != null) {
                val performance by current.hands.performance.collectAsStateWithLifecycle()
                Text(String.format(Locale.ROOT, "%d fps · %d ms", performance.fps, performance.inferenceMs), color = Color.Yellow)
                if (status.quad != null) Text(if (status.tracking) "Tracking rectangle" else "Screen candidate",
                    color = if (status.tracking) Color.Green else Color.Yellow)
            }
        }
    }
}
