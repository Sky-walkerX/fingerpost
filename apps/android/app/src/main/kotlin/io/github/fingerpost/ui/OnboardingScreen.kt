package io.github.fingerpost.ui

import android.os.Handler
import android.os.Looper
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import io.github.fingerpost.R
import io.github.fingerpost.engine.TtsSpeaker
import io.github.fingerpost.guidance.OnboardingGuide
import io.github.fingerpost.guidance.Priority
import io.github.fingerpost.guidance.Utterance
import io.github.fingerpost.onboarding.onboardingStore
import kotlinx.coroutines.launch

/** Capture and session creation wait for a successful read and completion of the local tutorial. */
@Composable
fun OnboardingGate(content: @Composable () -> Unit) {
    val context = LocalContext.current
    val store = remember(context) { onboardingStore(context) }
    var completed by remember { mutableStateOf<Boolean?>(null) }
    var failed by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(store) {
        try { store.completed.collect { completed = it } }
        catch (_: java.io.IOException) { failed = true }
    }
    when {
        failed -> Text(stringResource(R.string.tutorial_storage_unavailable), Modifier.safeDrawingPadding().padding(24.dp))
        completed == true -> content()
        completed == false -> {
            var saveFailed by remember { mutableStateOf(false) }
            val finish = {
                scope.launch {
                    try { store.markCompleted(); saveFailed = false }
                    catch (_: java.io.IOException) { saveFailed = true }
                }
                Unit
            }
            if (saveFailed) Column(Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp)) {
                Text(stringResource(R.string.tutorial_save_failed))
                Button(onClick = finish) { Text(stringResource(R.string.retry)) }
            } else OnboardingScreen(onComplete = finish)
        }
        else -> Box(Modifier.fillMaxSize().background(Color.Black))
    }
}

@Composable
private fun OnboardingScreen(onComplete: () -> Unit) {
    val context = LocalContext.current
    val owner = LocalLifecycleOwner.current
    val guide = remember { OnboardingGuide() }
    var prompt by remember { mutableStateOf(guide.prompt) }
    var active by remember { mutableStateOf(false) }
    var speechFailed by remember { mutableStateOf(false) }
    val complete by rememberUpdatedState(onComplete)
    val main = remember { Handler(Looper.getMainLooper()) }
    val speaker = remember(context) { TtsSpeaker(context, onDone = { finished ->
        main.post {
            finished.completionId?.let { prompt = guide.speechDone(it) }
            if (guide.complete) complete()
        }
    }, onError = { main.post { speechFailed = true } }) }
    DisposableEffect(owner, speaker) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_START) active = true
            if (event == Lifecycle.Event.ON_STOP) { active = false; speaker.stop() }
        }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer); speaker.shutdown() }
    }
    LaunchedEffect(prompt?.id, active) {
        if (active) prompt?.let { speaker.speak(Utterance(it.text, Priority.STATE, android.os.SystemClock.elapsedRealtime(), it.id), false) }
    }
    val repeat = { speechFailed = false; prompt = guide.repeat(); Unit }
    val skip = { guide.skip(); speaker.stop(); complete(); Unit }
    val skipLabel = stringResource(R.string.skip_tutorial)
    val repeatLabel = stringResource(R.string.repeat_tutorial)
    val instruction = prompt?.text.orEmpty()
    val accessibleInstruction = if (speechFailed) instruction + " " + stringResource(R.string.tutorial_speech_failed) else instruction
    Column(Modifier.fillMaxSize().background(Color.Black).safeDrawingPadding().padding(24.dp)
        .clickable(onClick = repeat)
        .pointerInput(Unit) {
            awaitEachGesture {
                awaitFirstDown(requireUnconsumed = false)
                var distance = 0f
                var twoFingers = false
                do {
                    val event = awaitPointerEvent()
                    if (event.changes.count { it.pressed } >= 2) {
                        twoFingers = true
                        distance += event.changes.map { it.positionChange().getDistance() }.average().toFloat()
                    }
                    if (twoFingers && distance > viewConfiguration.touchSlop) { skip(); break }
                } while (event.changes.any { it.pressed })
            }
        }.clearAndSetSemantics {
            contentDescription = accessibleInstruction
            onClick(label = repeatLabel) { repeat(); true }
            customActions = listOf(CustomAccessibilityAction(skipLabel) { skip(); true })
        }, verticalArrangement = Arrangement.Center) {
        Text(instruction, color = Color.White)
        Spacer(Modifier.height(24.dp))
        Text(stringResource(R.string.tutorial_gestures), color = Color.White)
        if (speechFailed) Text(stringResource(R.string.tutorial_speech_failed), color = Color.White)
    }
}
