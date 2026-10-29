# Android integration handoff — 2026-10-30

Implementation and local checks are recorded here. Phone acceptance belongs to teammates, as requested by the user. No device or live-model result is claimed.

## Implemented

- The session screen now owns a lifecycle-scoped guidance engine. Camera analysis feeds the screen tracker; fresh hand results feed pad compensation, homography, filtering, zones, speech, tone and haptics.
- The engine connects with the existing Firebase/attestation client, waits for `ready`, requests microphone permission and starts recording after the spoken question. Final gateway transcripts advance the guide workflow. Backgrounding closes capture, audio, sockets, sensors and vision resources.
- Framing uses local quad stability and coaching, with a full-frame fallback after four seconds. Server corners re-anchor through capture-time tracking; target delivery waits until the new anchor is applied. Lost tracking returns to framing.
- Press evidence supports linked simulator touches, masked screen change and dwell followed by release. Verification replies must match the outstanding keyframe id. DONE waits for the actual matching TTS completion; canceled, stale and failed utterances cannot complete it.
- Every encoded frame uses its own OCR. Raw and rectified PIN detections can block it; an atomic final send check also blocks previously encoded frames after local or server PIN entry. Microphone sends use the same guard. PIN exit needs continuous successful OCR evidence, clears the old target and requests a fresh locate for the retained goal.
- Text targets use local OCR agreement; uncertain text/icon targets announce uncertainty. Irreversible roles are refused while Day 4 confirmation support remains unimplemented. Oversized JPEGs are dropped rather than sent beyond the protocol limit.

## Local verification

Run from the repository root, with JDK 21 and SDK 37 configured per `docs/local-development.md`:

```sh
./scripts/android.sh :core:guidance:test :core:protocol:test :app:test :app:assembleDebug :app:lintDebug --console=plain
```

Final local run: 148 guidance, 49 protocol and 5 app cases pass with no failures, errors or skips. The debug APK and lint pass; lint reports six advisories. CI now includes app unit tests.

New synthetic regressions cover fingertip geometry, duplicate/older hand timestamps, hand selection, off-screen input, filter reset, stale queued speech callbacks, PIN exit/reacquire and upload-guard boundaries. Tests contain synthetic labels only. No protocol schema or dependency version changed.

## Teammate acceptance checklist — pending

1. Configure `fingerpost.gatewayUrl=ws://<laptop-ip>:8080` privately and run the mock gateway. Install the debug APK from `apps/android/app/build/outputs/apk/debug/app-debug.apk`.
2. Verify microphone denial gives a usable next action; allow it in Settings and reopen. Confirm `ready`, the spoken question, final transcript and `goal.ack`. Confirm the mic does not capture the app's own prompts.
3. Open a simulator scene with a fixed synthetic `run` query parameter. Link the debug app using the same value:

   ```sh
   adb shell am force-stop io.github.fingerpost
   adb shell am start -n io.github.fingerpost/.MainActivity --es fingerpost.simRunId integration-run
   ```

   The simulator URL must use `run=integration-run&gw=http://<laptop-ip>:8080` (plus `token` if configured). Verify a full guide → ON → press → verify → spoken Done → idle loop. An unrelated run must not verify a press.
4. Check the quad locks, follows a slow pan and stays fixed when the hand covers it. Check pad/target geometry in portrait and landscape; verify wrong/missing OCR announces uncertainty. If local quad acquisition fails, the gateway must provide `layout.screenQuad` for the fallback path; the current mock layout may omit it.
5. Check tone frequency, stereo pan, NEAR pulsing, ON double haptic/earcon, no-hand mute, framing cut-off cues, glare and lost-tracking recovery. Check a real screen change and dwell/occlusion release separately from simulator touch evidence.
6. Open phone, calculator and scrambled PIN layouts, including a transition during verification. Confirm the first detected PIN frame is blocked, the mic ends, “Cloud off” is shown and subsequent gateway keyframe counts stop. Failed OCR must not resume uploads. After the keypad disappears, confirm fresh locate and “Back online.” Record counts only; never capture frame payloads, PIN digits, transcripts or OCR text.
7. With TalkBack enabled, verify a single labeled session action and no duplicate guidance announcements. Background/reopen repeatedly and verify capture/audio stop and a new socket session starts. Repeat the required ten-minute accessibility session.
8. Check configured Firebase authentication, hardware attestation and token refresh with the credential holder. Do not put credentials or signing/device identifiers in the report.

Record generic device labels, pass/fail, numeric measurements and unresolved issues in `docs/progress.md`. Leave each device task blocked until its full acceptance checklist passes.

## Remaining scope

Day 4 task/confirm turns, earphone-only digit help, locale tables and settings are separate tasks. Day 3 focus/exposure metering and persisted onboarding are still pending. Tracking performance gates, live quality/region acceptance and the proxy trials remain open. This guide-only APK is not a release-gate pass.
