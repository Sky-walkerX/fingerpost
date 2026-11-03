package io.github.fingerpost.ui

import android.Manifest
import android.view.View
import android.view.SurfaceView
import java.io.File
import io.github.fingerpost.camera.FrameSource
import io.github.fingerpost.camera.PhoneCameraSource
import io.github.fingerpost.camera.MockGlassesSource
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Button
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextButton
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalResources
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
import io.github.fingerpost.settings.Settings
import io.github.fingerpost.settings.HardwareCue
import io.github.fingerpost.vision.TrackingOptions
import java.util.Locale

@Composable
fun SessionScreen(
    onToggle: () -> Unit = {},
    trackingOptions: TrackingOptions = TrackingOptions(),
    simRunId: String? = null,
    replayFile: File? = null,
    settings: Settings = Settings(),
    availableUpdate: String? = null,
    onUpdateAnnounced: (String) -> Unit = {},
    onOpenSettings: () -> Unit = {},
    onKeyHandlerChanged: (((HardwareCue) -> Boolean)?) -> Unit = {}
) {
    val context = LocalContext.current
    val resources = LocalResources.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val description = stringResource(R.string.session_description)
    val preview = remember(context) { PreviewView(context).apply {
        scaleType = PreviewView.ScaleType.FILL_CENTER
        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        isClickable = false; isFocusable = false
    } }
    val replayPreview = remember(context) { SurfaceView(context).apply {
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
    } }
    var engine by remember { mutableStateOf<GuidanceEngine?>(null) }
    var cameraUnavailable by remember { mutableStateOf(false) }
    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        engine?.micPermissionResult(it)
    }
    DisposableEffect(preview, lifecycleOwner, trackingOptions, simRunId, replayFile) {
        var pipeline: FrameSource? = null
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
                    val current = GuidanceEngine(context, trackingOptions, simRunId, settings,
                        onMeteringPoint = { point, width, height -> pipeline?.meterAt(point, width, height) }) {
                        micPermission.launch(Manifest.permission.RECORD_AUDIO)
                    }
                    engine = current
                    pipeline = if (replayFile != null) MockGlassesSource(replayFile, replayPreview,
                        onFrame = current::submit, onError = { cameraUnavailable = true })
                    else PhoneCameraSource(CameraPipeline(context, lifecycleOwner, preview,
                        onFrame = { bitmap, ts -> current.hands.submit(bitmap, ts) },
                        onError = { cameraUnavailable = true }, onAnalysisFrame = current::submit))
                    pipeline?.start()
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
        cameraUnavailable && replayFile != null -> stringResource(R.string.replay_unavailable)
        cameraUnavailable -> stringResource(R.string.camera_unavailable)
        trackingUnavailable -> stringResource(R.string.tracking_unavailable)
        else -> status.message
    }
    val baseLabel = when {
        status.donationUploading -> resources.getString(R.string.donation_uploading)
        status.basicMode -> resources.getString(R.string.basic_mode)
        status.cloudOff -> resources.getString(R.string.cloud_off)
        !status.connected -> resources.getString(R.string.connecting)
        else -> when (status.state) {
            GState.IDLE -> resources.getString(R.string.ready)
            GState.LISTENING -> resources.getString(R.string.listening)
            GState.FRAMING -> resources.getString(R.string.frame_screen)
            GState.LOCATING -> resources.getString(R.string.finding)
            GState.GUIDING -> resources.getString(R.string.guiding)
            GState.ON_TARGET -> resources.getString(R.string.on_target)
            GState.VERIFYING -> resources.getString(R.string.checking_press)
            GState.ASK -> resources.getString(R.string.waiting_answer)
            GState.CONFIRM -> resources.getString(R.string.confirm_amount)
            GState.AWAIT_NEXT -> resources.getString(R.string.next_step)
            GState.PIN_MODE -> resources.getString(R.string.pin_entry)
            GState.DONE -> resources.getString(R.string.done)
            GState.EXPLORING -> resources.getString(R.string.reading_screen)
            GState.TOUCH_EXPLORE -> resources.getString(R.string.touch_explore)
        }
    }
    val label = if (replayFile != null) resources.getString(R.string.mock_glasses_status, baseLabel) else baseLabel
    LaunchedEffect(current, status.state, availableUpdate, settings.speech) {
        if (availableUpdate != null && settings.speech && current != null) {
            while (!current.announceUpdateIfIdle { onUpdateAnnounced(availableUpdate) })
                kotlinx.coroutines.delay(1000)
        }
    }
    status.donationQuestion?.let { question ->
        AlertDialog(onDismissRequest = { current?.respondDonation(null) },
            text = { Text(question, modifier = Modifier.verticalScroll(rememberScrollState())) },
            confirmButton = { TextButton(onClick = { current?.respondDonation(true) }) {
                Text(stringResource(R.string.donation_yes))
            } },
            dismissButton = { TextButton(onClick = { current?.respondDonation(false) }) {
                Text(stringResource(R.string.donation_no))
            } })
    }
    val toggleLabel = stringResource(if (status.state == GState.IDLE) R.string.start_session else R.string.stop_session)
    val toggle = { current?.toggle(); onToggle() }
    DisposableEffect(current, settings.volumeKeys) {
        onKeyHandlerChanged(if (current != null && settings.volumeKeys) current::hardwareCue else null)
        onDispose { onKeyHandlerChanged(null) }
    }
    LaunchedEffect(current, settings) {
        current?.updateSettings(settings)
    }
    Box(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize().background(Color.Black).clickable(onClick = toggle).clearAndSetSemantics {
            contentDescription = error ?: description
            stateDescription = label
            onClick(label = toggleLabel) { toggle(); true }
        }) {
            AndroidView(factory = { if (replayFile != null) replayPreview else preview }, modifier = Modifier.fillMaxSize())
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
                if (status.state in setOf(GState.GUIDING, GState.ON_TARGET) && status.targetOutline.size >= 3) {
                    val transform = FrameTransform.fillCenter(status.frameWidth, status.frameHeight,
                        size.width.toInt().coerceAtLeast(1), size.height.toInt().coerceAtLeast(1))
                    val outline = Path()
                    status.targetOutline.forEachIndexed { i, p ->
                        val point = transform.map((p.x * status.frameWidth).toFloat(), (p.y * status.frameHeight).toFloat())
                        if (i == 0) outline.moveTo(point.x, point.y) else outline.lineTo(point.x, point.y)
                    }
                    outline.close()
                    drawPath(outline, Color.Black, style = Stroke(10.dp.toPx()))
                    drawPath(outline, Color.Yellow, style = Stroke(6.dp.toPx()))
                }
                for (sample in samples) {
                    val transform = FrameTransform.fillCenter(sample.frameW, sample.frameH,
                        size.width.toInt().coerceAtLeast(1), size.height.toInt().coerceAtLeast(1))
                    val point = transform.map(sample.tipX, sample.tipY)
                    drawCircle(Color.Black, 14.dp.toPx(), Offset(point.x, point.y), style = Stroke(10.dp.toPx()))
                    drawCircle(Color.Yellow, 14.dp.toPx(), Offset(point.x, point.y), style = Stroke(6.dp.toPx()))
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
        Button(
            onClick = onOpenSettings,
            modifier = Modifier
                .safeDrawingPadding()
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(16.dp)
                .clearAndSetSemantics {
                    contentDescription = resources.getString(R.string.settings)
                    role = Role.Button
                    onClick(label = resources.getString(R.string.open_settings)) { onOpenSettings(); true }
                }
        ) {
            Text(resources.getString(R.string.settings))
        }
    }
}
