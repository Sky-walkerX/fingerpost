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
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.opencv.android.OpenCVLoader
import io.github.fingerpost.guidance.KeyframePurpose as Purpose
import io.github.fingerpost.guidance.Priority as SpeechPriority
import io.github.fingerpost.protocol.Target as ServerTarget
import io.github.fingerpost.settings.*
import io.github.fingerpost.offline.OfflineAsr
import io.github.fingerpost.offline.OfflineLocate
import io.github.fingerpost.offline.OfflineSession
import io.github.fingerpost.memory.layoutStore

/** State, speech and session callbacks are serialized on the main dispatcher. Native vision stays off it. */
class GuidanceEngine(
    private val context: Context,
    trackingOptions: TrackingOptions = TrackingOptions(),
    private val simRunId: String? = null,
    private var settings: Settings = Settings(),
    private val onMeteringPoint: (Vec2, Int, Int) -> Unit = { _, _, _ -> },
    private val requestMicPermission: () -> Unit,
) {
    data class Status(val state: GState = GState.IDLE, val connected: Boolean = false, val cloudOff: Boolean = false,
        val message: String? = null, val quad: List<Vec2>? = null, val frameWidth: Int = 1, val frameHeight: Int = 1,
        val tracking: Boolean = false, val basicMode: Boolean = false, val targetOutline: List<Vec2> = emptyList())
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
    private val metering = ScreenMetering()
    private val tone = ToneSynth()
    private val haptics = Haptics(context)
    private val earcons = Earcons()
    /** A5-1: names the element under the finger over the last layout. Local only: nothing is uploaded. */
    private val explorer = TouchExplorer()
    /**
     * A6-1 basic mode: no network, mode{offline} or the kill switch. Goals come from on-device speech, targets from
     * on-device OCR boxes, and nothing is uploaded. It lasts until the session ends while the cloud is back.
     */
    private var offline = false
    /**
     * A5-2: the user's own screens, for an instant re-lock. A guide goal on a remembered screen is guided at once
     * when fresh OCR agrees; the keyframe still goes to the gateway, whose target confirms or replaces it.
     */
    private val layoutCache = LocalLayoutCache(layoutStore(context))
    private var goalText = ""
    private var goalIntent: String? = null
    private var relockKey: Long? = null
    private var relockLabel = ""
    private var onlineWhenIdle = false
    private var offlineGoal = ""
    private var lastEvidence: Evidence? = null
    private var disconnectedSince: Long? = null
    private var offlineAsrMissing = false
    private val offlineSession = OfflineSession()
    private val offlineAsr = OfflineAsr(context, onFinal = { text -> post { offlineHeard(text) } }, onUnavailable = { post {
        wantsMic = false
        if (!offlineAsrMissing) { offlineAsrMissing = true; say(Strings.get(Key.OFFLINE_ASR_UNAVAILABLE, machine.locale), SpeechPriority.STATE) }
    } })
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
    /** The gateway closed the task while the keypad was up; end quietly once PIN entry is over. */
    private var finishedDuringPin = false
    /** guidance-spec §10: layout and digit-under-finger, earphones only. Digits never reach logs or status. */
    private val pinHelp = PinMode(context, onEarphonesLost = {
        post { say(Strings.get(Key.EARPHONES_DISCONNECTED, machine.locale), SpeechPriority.SAFETY) }
    }, onVoiceUnavailable = { warning -> post { say(warning, SpeechPriority.STATE) } })
    private val digitUnder = DigitUnderFinger()
    private var lastCue: String? = null
    private var layoutAnnounced = false
    private val sensorManager = context.getSystemService(SensorManager::class.java)
    private val gravity = object : SensorEventListener {
        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
        override fun onSensorChanged(event: SensorEvent) {
            pitch = cameraPitchBelowHorizon(event.values[0].toDouble(), event.values[1].toDouble(), event.values[2].toDouble())
        }
    }
    private val client = SessionClient(
        hello = {
            val priv = if (settings.privateMode) Privacy.PRIVATE else Privacy.NORMAL
            val loc = when (settings.locale.lowercase()) {
                "hi" -> io.github.fingerpost.protocol.Locale.HI
                "es" -> io.github.fingerpost.protocol.Locale.ES
                else -> io.github.fingerpost.protocol.Locale.EN
            }
            Hello(newId(), nowMs(), BuildConfig.VERSION_NAME, PROTOCOL, loc,
                RequestedMode.AUTO, priv, Caps(simRunId = simRunId))
        },
        token = auth::token,
        refreshAfterMs = auth::refreshAfterMs,
        onAuthExpired = { auth.invalidate() },
    )
    private val guard: UploadGuard = UploadGuard(
        onEnter = { mic.stop(); post { pinEntered() } },
        onExit = { post { pinExited() } },
    )
    private val mic: MicStreamer = MicStreamer(client, guard)
    private val updateNotice = io.github.fingerpost.updates.NoticeCompletion()
    private val speaker = TtsSpeaker(context, onDone = { finished -> post {
        if (speech.onDone(finished)) {
            updateNotice.succeeded(finished)
            finished.completionId?.let { dispatch(GEvent.SpeechDone(time(), it)) }
            pumpSpeech()
        }
    } }, onError = { failed -> post {
        updateNotice.clear()
        if (failed == null || speech.onDone(failed))
            mutableStatus.value = mutableStatus.value.copy(message = Strings.get(if (offline) Key.OFFLINE_TTS_UNAVAILABLE else Key.SPEECH_UNAVAILABLE, machine.locale))
    } })
    private val router = FrameRouter(hands, guard, onFrame = { post { vision(it) } }, onKeyframe = { post { encoded(it) } },
        onError = { post { tone.stop(); mutableStatus.value = mutableStatus.value.copy(message = Strings.get(Key.CAMERA_RECOVERY, machine.locale)) } })

    init {
        settings = settings.safeOutputs()
        speaker.setRate(settings.speechRate)
        pinHelp.setRate(settings.speechRate)
        speaker.setLocale(settings.locale)
        pinHelp.setLocale(settings.locale)
        machine.locale = guidanceLocale(settings.locale)
        machine.chestMount = settings.holdMode == HoldMode.CHEST_MOUNT
        if (!openCvReady) {
            mutableStatus.value = mutableStatus.value.copy(message = Strings.get(Key.CAMERA_RECOVERY, machine.locale))
            say(Strings.get(Key.CAMERA_TRACKING_FAILED, machine.locale), SpeechPriority.STATE)
        } else {
            scope.launch { client.messages.collect(::server) }
            scope.launch { client.connected.collect { connected ->
                mutableStatus.value = mutableStatus.value.copy(connected = connected)
                disconnectedSince = if (connected) null else disconnectedSince ?: time()
                // A basic-mode session doesn't need the socket, so losing it changes nothing there.
                if (!connected && !offline) { ready = false; reset(); wantsStart = true }
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

    fun updateSettings(newSettings: Settings) {
        settings = newSettings.safeOutputs()
        speaker.setRate(settings.speechRate)
        pinHelp.setRate(settings.speechRate)
        speaker.setLocale(newSettings.locale)
        pinHelp.setLocale(newSettings.locale)
        machine.locale = guidanceLocale(newSettings.locale)
        machine.chestMount = settings.holdMode == HoldMode.CHEST_MOUNT
        if (!newSettings.tone) tone.stop()
    }

    fun toggle() {
        if (guard.pinMode) return
        if (machine.state == GState.IDLE) {
            wantsStart = true
            if (ready || offline) { wantsStart = false; dispatch(GEvent.Start(time())) }
        } else {
            client.send(Abort(newId(), nowMs()))
            reset()
        }
    }

    fun micPermissionResult(granted: Boolean) {
        wantsMic = granted && (ready || offline) && !guard.pinMode && machine.state in LISTENING_STATES
        if (!granted) {
            wantsMic = false
            say(Strings.get(Key.MIC_PERMISSION_NEEDED, machine.locale), SpeechPriority.STATE)
        }
    }

    private fun reset() {
        generation++
        lastCue = null
        wantsMic = false
        mic.stop()
        offlineAsr.stop()
        tone.stop()
        updateNotice.clear()
        speaker.stop()
        speech.clear()
        finger.clear()
        planner.reset()
        router.cancelKeyframes()
        capture = null; layout = null; verifyId = null; polygon = emptyList(); pendingTarget = null; awaitingAnchor = false
        explorer.reset(); relockKey = null
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
            if (machine.state == GState.TOUCH_EXPLORE || before == GState.TOUCH_EXPLORE) explorer.reset()
            if (machine.state == GState.IDLE && onlineWhenIdle) leaveOffline()
        }
        mutableStatus.value = mutableStatus.value.copy(state = machine.state)
    }

    private fun effect(effect: Effect) {
        when (effect) {
            is Effect.Say -> say(effect.text, effect.priority, effect.completionId)
            Effect.OpenMic -> wantsMic = true
            Effect.CloseMic -> { wantsMic = false; mic.stop(); offlineAsr.stop() }
            is Effect.SendKeyframe -> if (offline) { if (!guard.pinMode) offlineKeyframe(effect.purpose) }
            else if (ready && !guard.pinMode) {
                router.requestKeyframe(when (effect.purpose) {
                    Purpose.LOCATE -> KeyframePurpose.LOCATE
                    Purpose.VERIFY -> KeyframePurpose.VERIFY
                    Purpose.EXPLORE -> KeyframePurpose.EXPLORE
                }, generation)
                if (effect.purpose == Purpose.LOCATE) tryRelock()
            }
            Effect.ToneOn -> Unit // A fresh valid hand sample supplies the frequency and starts audio.
            Effect.ToneOff -> tone.stop()
            is Effect.Haptic -> if (settings.haptics) haptics.play(effect.kind)
            Effect.SendTargetReached -> event(EventKind.TARGET_REACHED)
            Effect.SendScreenChanged -> event(EventKind.SCREEN_CHANGED)
            is Effect.SendTapDetected -> {
                lastEvidence = effect.evidence
                event(EventKind.TAP_DETECTED, EventDetail(TapEvidence.valueOf(effect.evidence.name)))
            }
            is Effect.SendAnswer -> client.send(Answer(newId(), nowMs(), effect.askId, effect.text))
            is Effect.SendConfirmReply -> client.send(ConfirmReply(newId(), nowMs(), effect.confirmId, effect.accepted, effect.utterance))
            // On the phone the UploadGuard owns PIN mode (it already stops uploads and the mic); the machine's
            // PIN_MODE effects are wired to it in A4-3.
            Effect.EnterPinMode, Effect.ExitPinMode, Effect.StopUploads, Effect.ResumeUploads -> Unit
        }
    }

    private fun event(kind: EventKind, detail: EventDetail? = null) { if (!offline) client.send(ClientEvent(newId(), nowMs(), kind, detail)) }
    private fun say(text: String, priority: SpeechPriority, completion: Long? = null) {
        if (!guard.pinMode) lastCue = text
        if (mic.isRunning) mic.stop()
        if (offlineAsr.isListening) offlineAsr.stop()
        act(speech.offer(Utterance(text, priority, time(), completion)))
        pumpSpeech()
    }
    private fun pumpSpeech() { act(speech.poll(time())) }
    private fun act(action: SpeechAction) {
        if (!settings.speech) {
            when (action) {
                is SpeechAction.Speak, is SpeechAction.Interrupt -> {
                    val u = if (action is SpeechAction.Speak) action.u else (action as SpeechAction.Interrupt).u
                    if (speech.onDone(u)) {
                        u.completionId?.let { dispatch(GEvent.SpeechDone(time(), it)) }
                        pumpSpeech()
                    }
                }
                SpeechAction.Wait -> Unit
            }
            return
        }
        when (action) {
            is SpeechAction.Speak -> speaker.speak(action.u, false)
            is SpeechAction.Interrupt -> { updateNotice.clear(); speaker.speak(action.u, true) }
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
        // guidance-spec §11b: 5 s without the gateway (no network) → basic mode.
        if (!offline && !guard.pinMode && disconnectedSince?.let { now - it >= 5_000 } == true) enterOffline()
        if (offline && wantsMic && speech.current == null && !offlineAsr.isListening && !offlineAsrMissing) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)
                offlineAsr.listen(asrLanguage(settings.locale))
            else { wantsMic = false; requestMicPermission() }
        }
        if (!offline && wantsMic && ready && speech.current == null && !mic.isRunning) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) mic.start()
            else { wantsMic = false; requestMicPermission() }
        }
    }

    private fun vision(frame: VisionFrame) {
        latest = frame
        metering.update(frame.quad, frame.stable, time())?.let { onMeteringPoint(it, frame.width, frame.height) }
        mutableStatus.value = mutableStatus.value.copy(quad = frame.quad, frameWidth = frame.width, frameHeight = frame.height,
            tracking = frame.tracking == TrackState.TRACKING,
            targetOutline = if (!guard.pinMode && machine.state in setOf(GState.GUIDING, GState.ON_TARGET)) {
                frame.quad?.let { quad -> Homography.fromPoints(Homography.UNIT_SQUARE, quad) }
                    ?.let { transform -> polygon.mapNotNull(transform::map) }?.takeIf { it.size == polygon.size }.orEmpty()
            } else emptyList())
        if (guard.pinMode) return
        if (frame.anchorApplied) {
            awaitingAnchor = false
            pendingTarget?.let { pendingTarget = null; target(it) }
        }
        val now = time()
        if (frame.tracking != TrackState.TRACKING) tone.stop()
        if (frame.tracking == TrackState.LOST && machine.state in setOf(GState.LOCATING, GState.GUIDING, GState.ON_TARGET)) {
            generation++; finger.clear(); planner.reset(); capture = null; layout = null; relockKey = null
            router.cancelKeyframes(); event(EventKind.LOST)
            dispatch(GEvent.TrackingLost(now))
        }
        if (frame.tracking == TrackState.DEGRADED && now - lastGlareAt >= 1500) {
            lastGlareAt = now; say(Strings.get(Key.HOLD_STEADY, machine.locale), SpeechPriority.STATE)
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
            lastGlareAt = now; say(Strings.get(Key.GLARE_WARNING, machine.locale), SpeechPriority.GUIDE)
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
        if (samples.isNotEmpty()) lastHandAt = time()
        if (guard.pinMode) { pinHand(samples); return }
        if (machine.state == GState.TOUCH_EXPLORE) { touchHand(samples); return }
        if (machine.state !in setOf(GState.GUIDING, GState.ON_TARGET)) return
        val now = time()
        lastHandAt = now
        val frame = latest
        val first = samples.firstOrNull()
        val usable = frame?.tracking == TrackState.TRACKING && first != null
        val result = if (usable) finger.update(first.frameTsMs, first.frameW, first.frameH,
            samples.map { HandSample(Vec2(it.tipX.toDouble(), it.tipY.toDouble()), Vec2(it.dipX.toDouble(), it.dipY.toDouble()), it.presence.toDouble(), it.hand) },
            frame.quad?.map { Vec2(it.x * first.frameW, it.y * first.frameH) }, preferredHand()) else null
        dispatch(GEvent.Frame(now, false, result != null, result?.zone))
        if (result == null || machine.state != GState.GUIDING || now < quietUntil) { tone.stop(); return }
        planner.plan(result.error, orientationFor(pitch), now)?.let { Phrases.render(it, machine.locale.language, CueVerbosity.valueOf(settings.verbosity.name)) }?.let { say(it, SpeechPriority.GUIDE) }
        tone.setFrequency(toneFrequencyHz(result.error.length))
        tone.setPan(tonePan(result.error.x))
        val radius = finger.target?.nearRadius ?: 1.0
        tone.setPulseHz(if (result.zone == Zone.NEAR) 4 + 8 * (1 - result.error.length / radius).coerceIn(0.0, 1.0) else 0.0)
        if (settings.tone) tone.start() else tone.stop()
    }

    private fun screenAspect(frame: VisionFrame, q: List<Vec2>): Double {
        val px = q.map { Vec2(it.x * frame.width, it.y * frame.height) }
        val w = ((px[1] - px[0]).length + (px[2] - px[3]).length) / 2
        val h = ((px[3] - px[0]).length + (px[2] - px[1]).length) / 2
        return if (w > 0 && h > 0) w / h else Double.NaN
    }

    /** guidance-spec §11c: a guide goal on a remembered screen, after the current dispatch (still LOCATING). */
    private fun tryRelock() {
        val gen = generation
        scope.launch(Dispatchers.Main) {
            if (closed || offline || gen != generation || guard.pinMode || machine.state != GState.LOCATING || goalIntent != "guide") return@launch
            val frame = latest ?: return@launch
            val q = frame.quad ?: return@launch
            val screen = KeyframeTokens.forScreen(router.latestTokens ?: return@launch, q)
            val aspect = screenAspect(frame, q)
            val key = layoutCache.keyIfStable(screen, aspect) ?: return@launch
            val cached = layoutCache.get(key) ?: return@launch
            when (val r = CacheRelock.decide(goalText, cached, screen, machine.locale)) {
                CacheRelock.Server -> Unit
                CacheRelock.Drop -> layoutCache.remove(key)
                is CacheRelock.Guide -> {
                    polygon = r.element.polygon
                    finger.setTarget(polygon, aspect)
                    planner.reset()
                    relockKey = key; relockLabel = r.element.label
                    dispatch(GEvent.TargetArrived(time(), r.say, r.element.role))
                }
            }
        }
    }

    /** The gateway's own target after a re-lock: the same label keeps guiding; anything else replaces the entry. */
    private fun confirmRelock(message: ServerTarget) {
        val key = relockKey ?: return
        relockKey = null
        val element = layout?.elements?.find { it.id == message.elementId } ?: return
        if (normalizeLabel(element.label) == normalizeLabel(relockLabel)) return
        layoutCache.remove(key)
        val role = element.role.name.lowercase()
        if (!machine.policy.mayGuide(role, element.id)) { reset(); say(Strings.get(Key.CONFIRM_FIRST, machine.locale), SpeechPriority.SAFETY); return }
        val frame = latest ?: return
        val aspect = screenAspect(frame, frame.quad ?: return)
        polygon = message.polygon.map { Vec2(it.u, it.v) }
        if (!aspect.isFinite() || QuadEstimator.quadArea(polygon) == 0.0) return
        finger.setTarget(polygon, aspect)
        planner.reset()
        say(message.say, SpeechPriority.STATE)
    }

    /** Guide-intent layouts of ordinary screens are remembered for next time; payment, PIN and confirm screens never. */
    private fun rememberLayout(message: Layout) {
        if (offline || goalIntent != "guide" || message.sensitivity != Sensitivity.NONE
            || message.screenType in setOf(ScreenType.PIN_PAD, ScreenType.PAYMENT_ENTRY, ScreenType.CONFIRM)) return
        val frame = latest ?: return
        val q = frame.quad ?: return
        val screen = KeyframeTokens.forScreen(router.latestTokens ?: return, q)
        val key = layoutCache.keyIfStable(screen, screenAspect(frame, q)) ?: return
        val elements = message.elements.filter { it.role != ElementRole.TEXT }
            .map { CachedElement(it.id, it.label, it.role.name.lowercase(), it.polygon.map { p -> Vec2(p.u, p.v) }) }
        if (elements.isNotEmpty()) layoutCache.put(key, CachedLayout(elements))
    }

    /** [reason] is the gateway's spoken error, said together with the mode so neither is dropped from the queue. */
    private fun enterOffline(reason: String? = null) {
        if (offline || closed) return
        val wasActive = wantsStart || machine.state != GState.IDLE
        reset()
        offline = true; ready = false; onlineWhenIdle = false; offlineAsrMissing = false
        speaker.setOfflineOnly(true)
        mutableStatus.value = mutableStatus.value.copy(cloudOff = true, basicMode = true)
        val notice = Strings.get(Key.BASIC_MODE, machine.locale)
        say(reason?.trim()?.takeIf { it.isNotEmpty() }?.let { "$it $notice" } ?: notice, SpeechPriority.STATE)
        if (wasActive && !guard.pinMode) { wantsStart = false; dispatch(GEvent.Start(time())) }
    }

    private fun leaveOffline() {
        speaker.stop(); speech.clear(); updateNotice.clear()
        offline = false; onlineWhenIdle = false
        speaker.setOfflineOnly(false)
        offlineAsr.stop()
        mutableStatus.value = mutableStatus.value.copy(cloudOff = !ready, basicMode = false)
        // A dropped socket counts again only from now on.
        disconnectedSince = if (mutableStatus.value.connected) null else time()
    }

    /** A final on-device transcript. Basic mode has only goals (no task or explore turns). */
    private fun offlineHeard(text: String) {
        if (!offline || machine.state != GState.LISTENING) return
        offlineGoal = text
        dispatch(GEvent.GoalHeard(time(), text))
    }

    /**
     * Basic mode answers the machine's keyframe requests locally, after the current dispatch finishes:
     * locate → resolve the goal against the screen's OCR; verify → the press evidence the phone already saw.
     */
    private fun offlineKeyframe(purpose: Purpose) {
        val gen = generation
        scope.launch(Dispatchers.Main) {
            if (closed || !offline || gen != generation || guard.pinMode) return@launch
            when (purpose) {
                Purpose.VERIFY -> dispatch(GEvent.VerifyArrived(time(), VerifyResult.OK, offlineSession.verifySay(lastEvidence, machine.locale)))
                Purpose.LOCATE, Purpose.EXPLORE -> offlineLocate()
            }
        }
    }

    private fun offlineLocate() {
        val frame = latest
        val q = frame?.quad
        val tokens = router.latestTokens
        if (frame == null || q == null || tokens == null) {
            dispatch(GEvent.TargetNotFound(time(), Strings.get(Key.LOCATE_FAILED, machine.locale))); return
        }
        when (val r = offlineSession.locate(offlineGoal, KeyframeTokens.forScreen(tokens, q), machine.locale)) {
            is OfflineLocate.NotFound -> dispatch(GEvent.TargetNotFound(time(), r.say))
            is OfflineLocate.Target -> {
                val pixels = q.map { Vec2(it.x * frame.width, it.y * frame.height) }
                val width = ((pixels[1] - pixels[0]).length + (pixels[2] - pixels[3]).length) / 2
                val height = ((pixels[3] - pixels[0]).length + (pixels[2] - pixels[1]).length) / 2
                if (width <= 0 || height <= 0) { dispatch(GEvent.TargetNotFound(time(), Strings.get(Key.LOCATE_FAILED, machine.locale))); return }
                polygon = r.polygon
                finger.setTarget(polygon, width / height)
                planner.reset()
                // The OCR box is the only source offline, so it's text by construction: never a pay-role element.
                dispatch(GEvent.TargetArrived(time(), r.say, "button"))
            }
        }
    }

    /** Touch-explore: the element under the finger's pad is named once it settles; leaving it plays an earcon. */
    private fun touchHand(samples: List<FingerSample>) {
        val now = time()
        lastHandAt = now
        tone.stop()
        val frame = latest
        val s = selectedHand(samples)
        val quad = frame?.quad
        val pad = if (s != null && frame != null && quad != null && frame.tracking == TrackState.TRACKING) {
            Homography.imageToScreen(quad.map { Vec2(it.x * s.frameW, it.y * s.frameH) })
                ?.map(padPoint(Vec2(s.tipX.toDouble(), s.tipY.toDouble()), Vec2(s.dipX.toDouble(), s.dipY.toDouble())))
                ?.takeIf { it.x.isFinite() && it.y.isFinite() && !isOffScreen(it) }
        } else null
        val elements = layout?.elements.orEmpty().map { e ->
            ExploreElement(e.id, e.label, e.role.name.lowercase(), e.polygon.map { Vec2(it.u, it.v) })
        }
        when (val cue = explorer.update(now, pad, elements)) {
            is ExploreCue.Speak -> say(cue.spoken(machine.locale), SpeechPriority.INFO)
            ExploreCue.Edge -> earcons.edge()
            null -> Unit
        }
    }

    /** PIN mode: announce the keypad layout once, then the digit under the finger's pad. Local only. */
    private fun pinHand(samples: List<FingerSample>) {
        val tokens = router.latestTokens ?: return
        if (!layoutAnnounced) classifyKeypad(tokens)?.let { if (pinHelp.speak(it.spoken(machine.locale))) layoutAnnounced = true }
        val s = selectedHand(samples)
        // guidance-spec §3 pad point: a quarter of the tip–DIP segment back from the tip.
        val pad = s?.let { Vec2((it.tipX - 0.25f * (it.tipX - it.dipX)).toDouble() / it.frameW,
            (it.tipY - 0.25f * (it.tipY - it.dipY)).toDouble() / it.frameH) }
        digitUnder.update(time(), pad, tokens)?.let { pinHelp.speak(it.toString()) }
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
            if (offline) {
                // The cloud is back: finish this session in basic mode, then switch.
                if (message.flags.cloudEnabled) { if (machine.state == GState.IDLE) leaveOffline() else onlineWhenIdle = true }
                ready = message.flags.cloudEnabled
                return
            }
            if (!message.flags.cloudEnabled) { enterOffline(); return }
            ready = message.flags.cloudEnabled
            mutableStatus.value = mutableStatus.value.copy(connected = true, cloudOff = guard.pinMode || !ready, message = null)
            if (wantsStart && ready && !guard.pinMode) { wantsStart = false; dispatch(GEvent.Start(time())) }
            return
        }
        if (message is Layout && serverLayoutIsPinScreen(message.screenType.name.lowercase(), message.elements.map { it.role.name.lowercase() })) {
            guard.enterPinMode(); return
        }
        if (message is Mode && message.mode == SessionMode.PIN) { guard.enterPinMode(); return }
        if (guard.pinMode) {
            if (message is Finish && message.result == FinishResult.DONE) finishedDuringPin = true
            return
        }
        when (message) {
            is Transcript -> if (message.final && message.text.isNotBlank()) when (machine.state) {
                GState.LISTENING -> { goalIntent = null; dispatch(GEvent.GoalHeard(time(), message.text)) }
                GState.ASK, GState.CONFIRM -> dispatch(GEvent.UserSaid(time(), message.text))
                // "more" and new goals are answered by the gateway; only "touch explore" is handled here.
                GState.EXPLORING -> dispatch(if (isTouchExploreCommand(message.text)) GEvent.TouchExploreRequested(time(), layout != null)
                    else GEvent.UserSaid(time(), message.text))
                else -> Unit
            }
            is GoalAck -> {
                goalText = message.goal; goalIntent = message.intent.name.lowercase()
                if (machine.state == GState.LISTENING) dispatch(GEvent.GoalHeard(time(), message.goal))
                dispatch(GEvent.IntentArrived(time(), message.intent.name.lowercase()))
            }
            is Layout -> {
                // A verify keyframe's layout arrives while VERIFYING; in task mode the next target refers to it.
                // After a cache re-lock it arrives while already GUIDING, and its target confirms the re-lock.
                val relocked = relockKey != null && machine.state in RELOCK_STATES
                if (machine.state !in LAYOUT_STATES && !relocked) return
                layout = message
                rememberLayout(message)
                val uploaded = capture
                if (uploaded != null && uploaded.encoded.header.kind == KeyframeKind.FULL) message.screenQuad?.let { quad ->
                    val size = uploaded.encoded.header.imageSize
                    awaitingAnchor = true
                    router.reanchor(quad.map { Vec2(it.x / size.w, it.y / size.h) }, uploaded.quad)
                }
            }
            is ServerTarget -> target(message)
            is Ask -> if (machine.state in TURN_STATES) dispatch(GEvent.AskArrived(time(), message.id, message.question, message.options))
            is Verify -> if (message.re == verifyId) { verifyId = null; dispatch(GEvent.VerifyArrived(time(), VerifyResult.valueOf(message.result.name), message.say)) }
            is SimTouch -> if (simRunId != null && message.runId == simRunId) dispatch(GEvent.PressDetected(time(), Evidence.SIM))
            is Say -> {
                say(message.text, SpeechPriority.valueOf(message.priority.name))
                if (machine.state == GState.EXPLORING) dispatch(GEvent.ExploreSaid(time()))
            }
            is Confirm -> if (machine.state in TURN_STATES) dispatch(GEvent.ConfirmArrived(time(), message.id, message.summary, message.amount?.let { spokenAmount(it) }))
            is Mode -> if (message.mode == SessionMode.OFFLINE) enterOffline()
            is ErrorMessage -> {
                if (message.code == ErrorCode.CLOUD_PAUSED || message.code == ErrorCode.QUOTA_EXHAUSTED) { enterOffline(message.say); return }
                reset(); say(message.say, SpeechPriority.STATE)
                if (message.code in setOf(ErrorCode.CLOUD_PAUSED, ErrorCode.QUOTA_EXHAUSTED, ErrorCode.VERSION_UNSUPPORTED)) {
                    ready = false
                    mutableStatus.value = mutableStatus.value.copy(cloudOff = true)
                }
                if (message.code == ErrorCode.AUTH_EXPIRED) scope.launch { auth.invalidate(); client.reconnect() }
            }
            is Finish -> when {
                machine.state == GState.IDLE -> Unit  // already ended here (e.g. the user said no to paying)
                message.result == FinishResult.DONE -> { tone.stop(); dispatch(GEvent.FinishArrived(time(), "done", message.say)) }
                else -> { reset(); say(message.say, SpeechPriority.STATE) }
            }
            else -> Unit
        }
    }

    private fun target(message: ServerTarget) {
        if (relockKey != null && machine.state in RELOCK_STATES) { confirmRelock(message); return }
        if (machine.state !in TURN_STATES) return
        if (awaitingAnchor) { pendingTarget = message; return }
        val element = layout?.elements?.find { it.id == message.elementId } ?: return
        val role = element.role.name.lowercase()
        // Device-side half of the pay rule (guidance-spec §11); the gateway enforces the same.
        if (!machine.policy.mayGuide(role, element.id)) {
            dispatch(GEvent.TargetArrived(time(), message.say, role)); return
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
            dispatch(GEvent.TargetNotFound(time(), Strings.get(Key.LOCATE_FAILED, machine.locale)))
            return
        }
        finger.setTarget(polygon, width / height)
        planner.reset()
        val tokens = router.latestTokens?.let { KeyframeTokens.forScreen(it, q) }.orEmpty()
        val agrees = if (element.role == ElementRole.ICON) message.confidence >= 0.75
            else twoSourceAgree(element.label, Bbox.of(polygon), tokens)
        val arrival = if (agrees) message.say else "${Strings.get(Key.UNCERTAIN_PREFIX, machine.locale)} ${element.label}, ${Strings.get(Key.UNCERTAIN_SUFFIX, machine.locale)}"
        dispatch(GEvent.TargetArrived(time(), arrival, role))
    }

    private fun pinEntered() {
        generation++; relockKey = null
        wantsMic = false
        updateNotice.clear()
        mic.stop(); tone.stop(); speaker.stop(); speech.clear()
        finger.clear(); planner.reset(); router.cancelKeyframes()
        capture = null; layout = null; verifyId = null; polygon = emptyList(); pendingTarget = null; awaitingAnchor = false
        mutableStatus.value = mutableStatus.value.copy(cloudOff = true)
        event(EventKind.PIN_MODE_ENTERED)
        say(Strings.get(Key.PIN_PAD_DETECTED, machine.locale), SpeechPriority.SAFETY)
        digitUnder.reset(); layoutAnnounced = false
        pinHelp.start()
        // Without earphones nothing about the keys is spoken: the speaker could be overheard.
        if (!pinHelp.earphonesConnected()) say(Strings.get(Key.CONNECT_EARPHONES, machine.locale), SpeechPriority.SAFETY)
    }
    private fun pinExited() {
        pinHelp.stop(); digitUnder.reset()
        event(EventKind.PIN_MODE_EXITED)
        mutableStatus.value = mutableStatus.value.copy(cloudOff = !ready)
        if (finishedDuringPin) {
            finishedDuringPin = false
            dispatch(GEvent.Abort(time()))
            say(Strings.get(Key.DONE, machine.locale), SpeechPriority.STATE)
            return
        }
        if (!offline) say(Strings.get(Key.BACK_ONLINE, machine.locale), SpeechPriority.STATE)
        if (ready || offline) {
            if (machine.state in setOf(GState.IDLE, GState.LISTENING, GState.DONE)) {
                dispatch(GEvent.Abort(time()))
                dispatch(GEvent.Start(time()))
            } else dispatch(GEvent.ResumeAfterPin(time()))
        }
    }

    fun announceUpdateIfIdle(onDone: () -> Unit): Boolean {
        if (machine.state != GState.IDLE || speech.current != null || !settings.speech) return false
        val utterance = Utterance(Strings.get(Key.UPDATE_AVAILABLE, machine.locale), SpeechPriority.STATE, time())
        updateNotice.track(utterance, onDone)
        act(speech.offer(utterance))
        pumpSpeech()
        return true
    }

    private fun preferredHand(): Handedness = if (settings.handedness == Hand.LEFT) Handedness.LEFT else Handedness.RIGHT

    private fun selectedHand(samples: List<FingerSample>): FingerSample? =
        samples.filter { it.presence >= MIN_HAND_PRESENCE && it.tipX in 0f..it.frameW.toFloat() && it.tipY in 0f..it.frameH.toFloat() }
            .minByOrNull { if (it.hand == preferredHand()) 0 else 1 }

    /** Foreground hardware actions never open the mic or request a keyframe. PIN speech stays isolated. */
    fun hardwareCue(cue: HardwareCue): Boolean {
        if (closed || guard.pinMode || settings.hardwareCue(true, false, cue) == null) return false
        when (cue) {
            HardwareCue.REPEAT -> lastCue?.let { say(it, SpeechPriority.INFO) }
            HardwareCue.UNDER_FINGER -> {
                val frame = latest
                val sample = selectedHand(hands.samples.value)
                val quad = frame?.quad
                val uv = if (sample != null && quad != null && frame.tracking == TrackState.TRACKING && time() - lastHandAt <= 200) {
                    Homography.imageToScreen(quad.map { Vec2(it.x * sample.frameW, it.y * sample.frameH) })
                        ?.map(padPoint(Vec2(sample.tipX.toDouble(), sample.tipY.toDouble()), Vec2(sample.dipX.toDouble(), sample.dipY.toDouble())))
                } else null
                val element = uv?.let { point -> layout?.elements?.filter { pointInPolygon(point, it.polygon.map { p -> Vec2(p.u, p.v) }) }
                    ?.minByOrNull { e -> Bbox.of(e.polygon.map { Vec2(it.u, it.v) }).let { b -> b.w * b.h } } }
                val text = if (element != null) {
                    if (element.role == ElementRole.TEXT) Strings.get(Key.TEXT_PREFIX, machine.locale) + ": " + element.label else element.label
                } else Strings.get(Key.RAISE_FINGER, machine.locale)
                say(text, SpeechPriority.INFO)
            }
        }
        return true
    }

    fun close() {
        updateNotice.clear()
        if (closed) return
        closed = true
        reset(); client.close(); sensorManager.unregisterListener(gravity)
        hands.close(); tone.release(); haptics.release(); earcons.release(); offlineAsr.close(); speaker.shutdown(); pinHelp.shutdown(); scope.cancel()
    }
    fun closeVision() { router.close() }

    private fun framingText(cue: FramingCue): String = Strings.framing(cue, machine.locale, settings.holdMode == HoldMode.CHEST_MOUNT)
    private companion object {
        val openCvReady by lazy { OpenCVLoader.initLocal() }
        /** States in which the gateway's next turn (target, ask, confirm) is expected. */
        val TURN_STATES = setOf(GState.LOCATING, GState.AWAIT_NEXT)
        val LAYOUT_STATES = setOf(GState.LOCATING, GState.VERIFYING, GState.AWAIT_NEXT, GState.EXPLORING)
        /** Where a cache re-lock is guiding before the gateway's layout and target arrive. */
        val RELOCK_STATES = setOf(GState.GUIDING, GState.ON_TARGET)
        /** States that listen to the user: a goal, an answer, a yes/no, or "more" while exploring. */
        val LISTENING_STATES = setOf(GState.LISTENING, GState.ASK, GState.CONFIRM, GState.EXPLORING)

        fun asrLanguage(tag: String): String = when {
            tag.lowercase().startsWith("hi") -> "hi-IN"
            tag.lowercase().startsWith("es") -> "es-ES"
            else -> "en-US"
        }

        fun guidanceLocale(tag: String): java.util.Locale = when {
            tag.lowercase().startsWith("hi") -> Strings.HI
            tag.lowercase().startsWith("es") -> Strings.ES
            else -> Strings.EN
        }

        /** "₹149" for the confirm prompt; the summary usually contains it already and then it isn't repeated. */
        fun spokenAmount(a: Amount): String {
            val number = if (a.value % 1.0 == 0.0) a.value.toLong().toString() else "%.2f".format(java.util.Locale.ROOT, a.value)
            return when (a.currency) {
                "INR" -> "₹$number"; "USD" -> "\$$number"; "EUR" -> "€$number"; "GBP" -> "£$number"
                else -> "$number ${a.currency}"
            }
        }
    }
}
