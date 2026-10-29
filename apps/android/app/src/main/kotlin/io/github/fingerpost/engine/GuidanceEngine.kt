package io.github.fingerpost.engine

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.SystemClock
import androidx.core.content.ContextCompat
import io.github.fingerpost.BuildConfig
import io.github.fingerpost.R
import io.github.fingerpost.audio.ToneSynth
import io.github.fingerpost.camera.AnalysisFrame
import io.github.fingerpost.guidance.*
import io.github.fingerpost.protocol.*
import io.github.fingerpost.safety.UploadGuard
import io.github.fingerpost.session.*
import io.github.fingerpost.vision.*
import kotlin.math.abs
import kotlin.math.atan2
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.opencv.android.OpenCVLoader
import io.github.fingerpost.guidance.KeyframePurpose as Purpose
import io.github.fingerpost.guidance.Priority as SpeechPriority
import io.github.fingerpost.protocol.Target as ServerTarget

/** State, speech and session callbacks are serialized on the main dispatcher. Native vision stays off it. */
class GuidanceEngine(
    private val context: Context,
    trackingOptions: TrackingOptions = TrackingOptions(),
    private val simRunId: String? = null,
    private val requestMicPermission: () -> Unit,
) {
    data class Status(val state: GState = GState.IDLE, val connected: Boolean = false, val cloudOff: Boolean = false,
        val message: String? = null, val quad: List<Vec2>? = null, val frameWidth: Int = 1, val frameHeight: Int = 1,
        val tracking: Boolean = false)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val mutableStatus = MutableStateFlow(Status())
    val status = mutableStatus.asStateFlow()
    val hands = HandTracker(context, trackingOptions)
    private val machine = GuidanceStateMachine()
    private val finger = FingerGuidance()
    private val planner = CuePlanner()
    private val speech = SpeechQueue()
    private val coach = FramingCoach()
    private val change = ScreenChangeDetector()
    private val tone = ToneSynth()
    private val haptics = Haptics(context)
    private val auth = Auth(context)
    @Volatile private var closed = false
    private var ready = false
    private var wantsStart = true
    private var wantsMic = false
    private var generation = 0L
    private var latest: VisionFrame? = null
    private var capture: KeyframeCapture? = null
    private var layout: Layout? = null
    private var awaitingAnchor = false
    private var pendingTarget: ServerTarget? = null
    private var verifyId: String? = null
    private var polygon: List<Vec2> = emptyList()
    private var framingSince = 0L
    private var fallbackSent = false
    private var quietUntil = 0L
    private var lastHandAt = Long.MIN_VALUE / 2
    private var lastGlareAt = Long.MIN_VALUE / 2
    private var lastGoodTick = Long.MIN_VALUE / 2
    private var pitch = 0.0
    private var onSince = 0L
    private var occluded = false
    private val sensorManager = context.getSystemService(SensorManager::class.java)
    private val gravity = object : SensorEventListener {
        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
        override fun onSensorChanged(event: SensorEvent) {
            pitch = Math.toDegrees(atan2(abs(event.values[2].toDouble()), abs(event.values[1].toDouble())))
        }
    }
    private val client = SessionClient(
        hello = { Hello(newId(), nowMs(), BuildConfig.VERSION_NAME, PROTOCOL, io.github.fingerpost.protocol.Locale.EN,
            RequestedMode.GUIDE, Privacy.NORMAL, Caps(simRunId = simRunId)) },
        token = auth::token,
        onAuthExpired = { auth.invalidate() },
    )
    private val guard: UploadGuard = UploadGuard(
        onEnter = { mic.stop(); post { pinEntered() } },
        onExit = { post { pinExited() } },
    )
    private val mic: MicStreamer = MicStreamer(client, guard)
    private val speaker = TtsSpeaker(context, onDone = { finished -> post {
        if (speech.onDone(finished)) {
            finished.completionId?.let { dispatch(GEvent.SpeechDone(time(), it)) }
            pumpSpeech()
        }
    } }, onError = { failed -> post {
        if (failed == null || speech.onDone(failed))
            mutableStatus.value = mutableStatus.value.copy(message = "Speech unavailable. Reopen Fingerpost.")
    } })
    private val router = FrameRouter(hands, guard, onFrame = { post { vision(it) } }, onKeyframe = { post { encoded(it) } },
        onError = { post { tone.stop(); mutableStatus.value = mutableStatus.value.copy(message = "Camera tracking couldn't start. Reopen Fingerpost.") } })

    init {
        if (!openCvReady) {
            mutableStatus.value = mutableStatus.value.copy(message = "Camera tracking couldn't start. Reopen Fingerpost.")
            say("Camera tracking couldn't start.", SpeechPriority.STATE)
        } else {
            scope.launch { client.messages.collect(::server) }
            scope.launch { client.connected.collect { connected ->
                mutableStatus.value = mutableStatus.value.copy(connected = connected)
                if (!connected) { ready = false; reset(); wantsStart = true }
            } }
            scope.launch { hands.samples.collect(::handResult) }
            scope.launch { tone.unavailable.collect { unavailable ->
                if (unavailable) mutableStatus.value = mutableStatus.value.copy(message = context.getString(R.string.tone_unavailable))
            } }
            scope.launch {
                while (isActive) { tick(); delay(100) }
            }
            sensorManager.getDefaultSensor(Sensor.TYPE_GRAVITY)?.let {
                sensorManager.registerListener(gravity, it, SensorManager.SENSOR_DELAY_UI)
            }
            client.start()
        }
    }

    private fun time() = SystemClock.elapsedRealtime()
    private fun post(action: () -> Unit) { scope.launch { if (!closed) action() } }
    fun submit(frame: AnalysisFrame) { if (closed || !openCvReady) frame.bitmap.recycle() else router.submit(frame) }

    fun toggle() {
        if (guard.pinMode) return
        if (machine.state == GState.IDLE) {
            wantsStart = true
            if (ready) { wantsStart = false; dispatch(GEvent.Start(time())) }
        } else {
            client.send(Abort(newId(), nowMs()))
            reset()
        }
    }

    fun micPermissionResult(granted: Boolean) {
        wantsMic = granted && ready && !guard.pinMode && machine.state == GState.LISTENING
        if (!granted) {
            wantsMic = false
            say("Microphone access is needed. Open settings to allow it.", SpeechPriority.STATE)
        }
    }

    private fun reset() {
        generation++
        wantsMic = false
        mic.stop()
        tone.stop()
        speaker.stop()
        speech.clear()
        finger.clear()
        planner.reset()
        router.cancelKeyframes()
        capture = null; layout = null; verifyId = null; polygon = emptyList(); pendingTarget = null; awaitingAnchor = false
        dispatch(GEvent.Abort(time()))
    }

    private fun dispatch(event: GEvent) {
        val before = machine.state
        machine.handle(event).forEach(::effect)
        if (machine.state != before) {
            if (machine.state == GState.FRAMING) { framingSince = time(); fallbackSent = false }
            if (machine.state == GState.ON_TARGET) {
                latest?.gray?.let(change::setReference)
                onSince = time(); occluded = false
            }
            if (before == GState.ON_TARGET && machine.state == GState.GUIDING) quietUntil = time() + 300
        }
        mutableStatus.value = mutableStatus.value.copy(state = machine.state)
    }

    private fun effect(effect: Effect) {
        when (effect) {
            is Effect.Say -> say(effect.text, effect.priority, effect.completionId)
            Effect.OpenMic -> wantsMic = true
            Effect.CloseMic -> { wantsMic = false; mic.stop() }
            is Effect.SendKeyframe -> if (ready && !guard.pinMode) router.requestKeyframe(
                if (effect.purpose == Purpose.LOCATE) KeyframePurpose.LOCATE else KeyframePurpose.VERIFY, generation)
            Effect.ToneOn -> Unit // A fresh valid hand sample supplies the frequency and starts audio.
            Effect.ToneOff -> tone.stop()
            is Effect.Haptic -> haptics.play(effect.kind)
            Effect.SendTargetReached -> event(EventKind.TARGET_REACHED)
            is Effect.SendTapDetected -> event(EventKind.TAP_DETECTED, EventDetail(TapEvidence.valueOf(effect.evidence.name)))
        }
    }

    private fun event(kind: EventKind, detail: EventDetail? = null) { client.send(ClientEvent(newId(), nowMs(), kind, detail)) }
    private fun say(text: String, priority: SpeechPriority, completion: Long? = null) {
        if (mic.isRunning) mic.stop()
        act(speech.offer(Utterance(text, priority, time(), completion)))
        pumpSpeech()
    }
    private fun pumpSpeech() { act(speech.poll(time())) }
    private fun act(action: SpeechAction) {
        when (action) {
            is SpeechAction.Speak -> speaker.speak(action.u, false)
            is SpeechAction.Interrupt -> speaker.speak(action.u, true)
            SpeechAction.Wait -> Unit
        }
    }

    private fun tick() {
        if (guard.pinMode) { tone.stop(); return }
        val now = time()
        dispatch(GEvent.Tick(now))
        if (machine.state == GState.FRAMING && !fallbackSent && now - framingSince >= 4000) {
            fallbackSent = true
            dispatch(GEvent.Frame(now, true, false, null))
        }
        if (now - lastHandAt > 200) {
            tone.stop()
            if (machine.state == GState.GUIDING || machine.state == GState.ON_TARGET)
                dispatch(GEvent.Frame(now, false, false, null))
        }
        pumpSpeech()
        if (wantsMic && ready && speech.current == null && !mic.isRunning) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) mic.start()
            else { wantsMic = false; requestMicPermission() }
        }
    }

    private fun vision(frame: VisionFrame) {
        latest = frame
        mutableStatus.value = mutableStatus.value.copy(quad = frame.quad, frameWidth = frame.width, frameHeight = frame.height,
            tracking = frame.tracking == TrackState.TRACKING)
        if (guard.pinMode) return
        if (frame.anchorApplied) {
            awaitingAnchor = false
            pendingTarget?.let { pendingTarget = null; target(it) }
        }
        val now = time()
        if (frame.tracking != TrackState.TRACKING) tone.stop()
        if (frame.tracking == TrackState.LOST && machine.state in setOf(GState.LOCATING, GState.GUIDING, GState.ON_TARGET)) {
            generation++; finger.clear(); planner.reset(); capture = null; layout = null
            router.cancelKeyframes(); event(EventKind.LOST)
            dispatch(GEvent.TrackingLost(now))
        }
        if (frame.tracking == TrackState.DEGRADED && now - lastGlareAt >= 1500) {
            lastGlareAt = now; say(Prompts.HOLD_STEADY, SpeechPriority.STATE)
        }
        val q = frame.quad?.map { Vec2(it.x * frame.width, it.y * frame.height) }
        if (machine.state == GState.FRAMING) {
            coach.cueToSpeak(q, frame.width, frame.height, now)?.let { say(framingText(it), SpeechPriority.GUIDE) }
            if (coach.evaluate(q, frame.width, frame.height) == FramingCue.GOOD && now - lastGoodTick >= 1500) {
                lastGoodTick = now; haptics.softTick()
            }
            val inView = frame.quad?.all { it.x in 0.04..0.96 && it.y in 0.04..0.96 } == true
            dispatch(GEvent.Frame(now, frame.stable && inView, false, null))
        }
        if (frame.glare && frame.stable && now - lastGlareAt >= 5000) {
            lastGlareAt = now; say("There's glare. Tilt the phone a little.", SpeechPriority.GUIDE)
        }
        if (machine.state == GState.ON_TARGET && frame.tracking == TrackState.TRACKING && frame.gray != null && frame.handMask != null) {
            if (change.update(frame.gray, frame.handMask)) dispatch(GEvent.PressDetected(now, Evidence.SCREEN_CHANGE))
            else if (now - onSince >= 800 && polygon.isNotEmpty()) {
                var covered = 0; var total = 0
                for (i in frame.handMask.indices) if (pointInPolygon(Vec2((i % 160 + 0.5) / 160, (i / 160 + 0.5) / 90), polygon)) {
                    total++; if (frame.handMask[i]) covered++
                }
                val covering = total > 0 && covered.toDouble() / total > 0.6
                if (occluded && !covering) dispatch(GEvent.PressDetected(now, Evidence.DWELL))
                occluded = covering
            }
        }
    }

    private fun handResult(samples: List<FingerSample>) {
        if (guard.pinMode || machine.state !in setOf(GState.GUIDING, GState.ON_TARGET)) return
        val now = time()
        lastHandAt = now
        val frame = latest
        val first = samples.firstOrNull()
        val usable = frame?.tracking == TrackState.TRACKING && first != null
        val result = if (usable) finger.update(first.frameTsMs, first.frameW, first.frameH,
            samples.map { HandSample(Vec2(it.tipX.toDouble(), it.tipY.toDouble()), Vec2(it.dipX.toDouble(), it.dipY.toDouble()), it.presence.toDouble()) },
            frame.quad?.map { Vec2(it.x * first.frameW, it.y * first.frameH) }) else null
        dispatch(GEvent.Frame(now, false, result != null, result?.zone))
        if (result == null || machine.state != GState.GUIDING || now < quietUntil) { tone.stop(); return }
        planner.plan(result.error, orientationFor(pitch), now)?.let(Phrases::render)?.let { say(it, SpeechPriority.GUIDE) }
        tone.setFrequency(toneFrequencyHz(result.error.length))
        tone.setPan(tonePan(result.error.x))
        val radius = finger.target?.nearRadius ?: 1.0
        tone.setPulseHz(if (result.zone == Zone.NEAR) 4 + 8 * (1 - result.error.length / radius).coerceIn(0.0, 1.0) else 0.0)
        tone.start()
    }

    private fun encoded(value: KeyframeCapture) {
        if (value.generation != generation || !ready || guard.pinMode) return
        val sent = guard.sendIfAllowed { client.send(value.encoded.header, value.encoded.jpeg) }
        if (sent) {
            capture = value
            if (value.encoded.header.purpose == KeyframePurpose.VERIFY) verifyId = value.encoded.header.id
        }
    }

    private fun server(message: ServerMessage) {
        if (message is Ready) {
            ready = message.flags.cloudEnabled
            mutableStatus.value = mutableStatus.value.copy(connected = true, cloudOff = guard.pinMode || !ready, message = null)
            if (wantsStart && ready && !guard.pinMode) { wantsStart = false; dispatch(GEvent.Start(time())) }
            return
        }
        if (message is Layout && message.screenType in setOf(ScreenType.PIN_PAD, ScreenType.PAYMENT_ENTRY)) {
            guard.enterPinMode(); return
        }
        if (message is Mode && message.mode == SessionMode.PIN) { guard.enterPinMode(); return }
        if (guard.pinMode) return
        when (message) {
            is Transcript -> if (message.final && message.text.isNotBlank() && machine.state == GState.LISTENING)
                dispatch(GEvent.GoalHeard(time(), message.text))
            is GoalAck -> if (machine.state == GState.LISTENING) dispatch(GEvent.GoalHeard(time(), message.goal))
            is Layout -> {
                if (machine.state != GState.LOCATING) return
                layout = message
                val uploaded = capture
                if (uploaded != null && uploaded.encoded.header.kind == KeyframeKind.FULL) message.screenQuad?.let { quad ->
                    val size = uploaded.encoded.header.imageSize
                    awaitingAnchor = true
                    router.reanchor(quad.map { Vec2(it.x / size.w, it.y / size.h) }, uploaded.quad)
                }
            }
            is ServerTarget -> target(message)
            is Ask -> if (machine.state == GState.LOCATING) dispatch(GEvent.TargetNotFound(time(), message.question))
            is Verify -> if (message.re == verifyId) { verifyId = null; dispatch(GEvent.VerifyArrived(time(), VerifyResult.valueOf(message.result.name), message.say)) }
            is SimTouch -> if (simRunId != null && message.runId == simRunId) dispatch(GEvent.PressDetected(time(), Evidence.SIM))
            is Say -> say(message.text, SpeechPriority.valueOf(message.priority.name))
            is Confirm -> { reset(); say("Payment confirmation is not available yet.", SpeechPriority.SAFETY) }
            is Mode -> if (message.mode == SessionMode.OFFLINE) { ready = false; reset(); mutableStatus.value = mutableStatus.value.copy(cloudOff = true); say("Cloud features are paused. Try again later.", SpeechPriority.SAFETY) }
            is ErrorMessage -> {
                reset(); say(message.say, SpeechPriority.STATE)
                if (message.code in setOf(ErrorCode.CLOUD_PAUSED, ErrorCode.QUOTA_EXHAUSTED, ErrorCode.VERSION_UNSUPPORTED)) {
                    ready = false
                    mutableStatus.value = mutableStatus.value.copy(cloudOff = true)
                }
                if (message.code == ErrorCode.AUTH_EXPIRED) scope.launch { auth.invalidate(); client.reconnect() }
            }
            is Finish -> if (message.result != FinishResult.DONE) { reset(); say(message.say, SpeechPriority.STATE) }
            else -> Unit
        }
    }

    private fun target(message: ServerTarget) {
        if (machine.state != GState.LOCATING) return
        if (awaitingAnchor) { pendingTarget = message; return }
        val element = layout?.elements?.find { it.id == message.elementId } ?: return
        if (element.role.isIrreversible) {
            dispatch(GEvent.TargetNotFound(time(), "I need you to confirm the amount first.")); return
        }
        val q = latest?.quad ?: capture?.quad ?: return
        val frame = latest ?: return
        val pixels = q.map { Vec2(it.x * frame.width, it.y * frame.height) }
        val width = ((pixels[1] - pixels[0]).length + (pixels[2] - pixels[3]).length) / 2
        val height = ((pixels[3] - pixels[0]).length + (pixels[2] - pixels[1]).length) / 2
        if (width <= 0 || height <= 0) return
        polygon = message.polygon.map { Vec2(it.u, it.v) }
        if (QuadEstimator.quadArea(polygon) == 0.0) {
            polygon = emptyList()
            dispatch(GEvent.TargetNotFound(time(), Prompts.LOCATE_FAILED))
            return
        }
        finger.setTarget(polygon, width / height)
        planner.reset()
        val tokens = router.latestTokens?.let { KeyframeTokens.forScreen(it, q) }.orEmpty()
        val agrees = if (element.role == ElementRole.ICON) message.confidence >= 0.75
            else twoSourceAgree(element.label, Bbox.of(polygon), tokens)
        val arrival = if (agrees) message.say else "I think this is ${element.label}, but I'm not sure."
        dispatch(GEvent.TargetArrived(time(), arrival))
    }

    private fun pinEntered() {
        generation++
        wantsMic = false
        mic.stop(); tone.stop(); speaker.stop(); speech.clear()
        finger.clear(); planner.reset(); router.cancelKeyframes()
        capture = null; layout = null; verifyId = null; polygon = emptyList(); pendingTarget = null; awaitingAnchor = false
        mutableStatus.value = mutableStatus.value.copy(cloudOff = true)
        event(EventKind.PIN_MODE_ENTERED)
        say("PIN pad detected. I'll stay offline while you enter it.", SpeechPriority.SAFETY)
    }
    private fun pinExited() {
        event(EventKind.PIN_MODE_EXITED)
        mutableStatus.value = mutableStatus.value.copy(cloudOff = !ready)
        say("Back online.", SpeechPriority.STATE)
        if (ready) {
            if (machine.state in setOf(GState.IDLE, GState.LISTENING, GState.DONE)) {
                dispatch(GEvent.Abort(time()))
                dispatch(GEvent.Start(time()))
            } else dispatch(GEvent.ResumeAfterPin(time()))
        }
    }

    fun close() {
        if (closed) return
        closed = true
        reset(); client.close(); sensorManager.unregisterListener(gravity)
        hands.close(); tone.release(); haptics.release(); speaker.shutdown(); scope.cancel()
    }
    fun closeVision() { router.close() }

    private fun framingText(cue: FramingCue): String = when (cue) {
        FramingCue.NO_SCREEN -> "I can't see a screen. Point the phone at it."
        FramingCue.CUT_LEFT -> "The screen's left edge is cut off. Move the phone left."
        FramingCue.CUT_RIGHT -> "The screen's right edge is cut off. Move the phone right."
        FramingCue.CUT_TOP -> "The screen's top edge is cut off. Move the phone up."
        FramingCue.CUT_BOTTOM -> "The screen's bottom edge is cut off. Move the phone down."
        FramingCue.MOVE_CLOSER -> "Move closer."
        FramingCue.MOVE_BACK -> "Move back a little."
        FramingCue.MOVE_LEFT -> "Move the phone left."
        FramingCue.MOVE_RIGHT -> "Move the phone right."
        FramingCue.MOVE_UP -> "Move the phone up."
        FramingCue.MOVE_DOWN -> "Move the phone down."
        FramingCue.GOOD -> ""
    }
    private companion object { val openCvReady by lazy { OpenCVLoader.initLocal() } }
}
