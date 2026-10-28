# Day 1 camera/fingertip device check — 2026-10-28

**D1-T7c is blocked, not complete.** Device label: connected Android test phone. No model or serial is recorded.

The user subsequently explicitly deferred unfinished T7c to implement T7d. See [the tone report](day1-tone.md) for that separate prototype and acceptance; no tracking check below has been waived or marked complete.

**Latest update:** user resumed profiling and supplied a comparison test phone. Fused transforms, callback-image cleanup and camera keep-awake are installed; all 25 guidance tests and 18 diagnostic-tool tests pass. The valid comparison GPU/two-hand run detects one pointing hand but reaches only 10–12 FPS / 43–86 ms (rolling max 87 ms). See [resumed investigation](day1-tracking-profile.md) for complete measurements and limitations. Earlier acceptance below is retained as evidence for the earlier build; the fused build still needs a visual/TalkBack regression check.

## Implemented and verified

- The public Hand Landmarker bundle matches the plan's SHA-256 and 7,819,105-byte size. Its copy inside the APK also matches. See [ASSETS.md](../../apps/android/ASSETS.md).
- CameraX binds the rear-camera preview and RGBA analysis to the activity lifecycle, uses a shared viewport, and closes each image proxy. The optimized tracker fuses crop/rotation/downscale into its upright letterboxed input while preserving original upright sample dimensions. Display/layout changes update rotation and viewport binding.
- HandLandmarker runs LIVE_STREAM on one GPU thread, tracks up to two hands, maps tip/DIP coordinates out of a 640×480 letterbox, and provides the planned sample fields. Initialization/runtime GPU errors attempt CPU fallback once per tracker. CPU fallback is implemented but was not triggered during these GPU runs.
- A yellow 14 dp fingertip dot and debug FPS/latency label are rendered over the preview. Their children are hidden from accessibility; the session retains one TalkBack action. Camera-screen TalkBack acceptance after adding the preview still needs device confirmation.
- Only one frame can be in flight. The optimized build reuses its model bitmap/MPImage and avoids camera bitmap conversion while the tracker is busy. Lifecycle stop closes the tracker and camera use cases.
- `./scripts/android.sh :core:guidance:test :app:test :app:assembleDebug :app:lintDebug --console=plain` passes. Guidance: **25 tests, 0 failures/errors/skips**. App unit-test task has no source cases. Lint: 0 errors, 4 advisories (planned target SDK, backup metadata, launcher icon, bitmap KTX suggestion). No checks were disabled.
- `./scripts/android.sh :app:installDebug --console=plain` succeeds after USB reconnection. Launch returns `Status: ok`. Final optimized APK was installed and launched.
- **Visual acceptance passed (2026-10-28):** the user confirmed that the yellow dot follows the index fingertip in portrait and landscape and disappears when the hand leaves view. This is direct on-device confirmation; no camera image was exported.

## Device performance

Requirement: **≥25 result FPS and ≤25 ms inference**.

| Run | Conditions and changes | Observed result | Gate |
|---|---|---|---|
| 1 | Original single-frame GPU implementation; model input allocated each submission | After startup, roughly 6–16 FPS / 43–180 ms sampled inference; hands detected in some results | Fail |
| 2 | Reused model input; skipped conversion while busy; app backgrounded between builds | After five initial logged windows: 20 windows, **8–11 FPS / 45–92 ms** sampled inference, **96 ms** worst window latency; 2 windows with a hand | Fail |

FPS is a rolling count of result callbacks in the preceding second, including no-hand results. Inference is elapsed monotonic time from `detectAsync` submission to result handling; it excludes camera conversion/letterboxing. Logs are emitted about once per second and include the maximum callback latency in the rolling window. The 45–92 ms range describes those logged samples, not every frame. The second probe requires every retained window to meet FPS and maximum-latency budgets.

The phone reported thermal status 1 (light throttling) during run 1. No controlled unthrottled comparison was made, so the cause of the shortfall is not established. The hand-count changes establish that the model returns both hand and no-hand results. Correct dot alignment in both orientations and disappearance on screen were subsequently confirmed by the user, independently of the telemetry.

Only the app's numeric tracking logs were read. No camera screenshot, recording, frame, landmark coordinates, or user content was exported. The exact second-probe command and its final output are preserved under [D1-T7c in progress.md](../progress.md#blockers).

## Remaining acceptance and next action

- Recheck visual following/disappearance in both orientations on the fused build. Earlier visual acceptance passed before this optimization.
- Confirm the added preview/debug content does not create extra TalkBack elements.
- Resolve the performance shortfall, then rerun the documented build/test/install and device acceptance. Do not reduce the target, change pinned dependencies, or claim a faster phone is necessary without investigation.
- The original two failed probes and two resumed comparison failures are recorded. AGENTS.md §9 requires stopping further attempts and task progression here. T7d remains unstarted.

## Foreground keep-awake follow-up — 2026-10-28

At the user's request, `MainActivity` now sets `FLAG_KEEP_SCREEN_ON` for its window. This covers both the camera session and the permission screen; the former preview-only setting was removed. Android applies this flag while the window is visible, so leaving the app restores normal sleep behavior. No wake-lock permission or system timeout change is needed.

The guidance tests (25 passed, no failures/errors/skips), app unit-test task (no source cases), debug build and lint pass. Lint retains 0 errors and the same 4 advisories. The updated APK is installed on both connected test phones.

On the comparison test phone, Fingerpost remained focused and awake for **125.2 seconds**, beyond the unchanged **120-second** system timeout. All sampled windows retained `KEEP_SCREEN_ON`; Android identified Fingerpost as the active screen-holding window. After Home and completion of the window transition, Fingerpost lost focus and released that screen hold. Reopening the app restored both. Only numeric power/window state was inspected; no camera content was exported. The broader T7c performance and accessibility/visual acceptance blockers above remain open.
