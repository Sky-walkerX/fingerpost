# Day 1 camera/fingertip device check — 2026-10-28

**D1-T7c is blocked, not complete.** Device label: connected Android test phone. No model or serial is recorded.

## Implemented and verified

- The public Hand Landmarker bundle matches the plan's SHA-256 and 7,819,105-byte size. Its copy inside the APK also matches. See [ASSETS.md](../../apps/android/ASSETS.md).
- CameraX binds the rear-camera preview and RGBA analysis to the activity lifecycle, uses a shared viewport, crops/rotates into upright pixels, and closes each image proxy. Display/layout changes update rotation and viewport binding.
- HandLandmarker runs LIVE_STREAM on one GPU thread, tracks up to two hands, maps tip/DIP coordinates out of a 640×480 letterbox, and provides the planned sample fields. Initialization/runtime GPU errors attempt CPU fallback once per tracker. CPU fallback is implemented but was not triggered during these GPU runs.
- A yellow 14 dp fingertip dot and debug FPS/latency label are rendered over the preview. Their children are hidden from accessibility; the session retains one TalkBack action. Camera-screen TalkBack acceptance after adding the preview still needs device confirmation.
- Only one frame can be in flight. The optimized build reuses its model bitmap/MPImage and avoids camera bitmap conversion while the tracker is busy. Lifecycle stop closes the tracker and camera use cases.
- `./scripts/android.sh :core:guidance:test :app:test :app:assembleDebug :app:lintDebug --console=plain` passes. Guidance: **18 tests, 0 failures/errors/skips**. App unit-test task has no source cases. Lint: 0 errors, 4 advisories (planned target SDK, backup metadata, launcher icon, bitmap KTX suggestion). No checks were disabled.
- `./scripts/android.sh :app:installDebug --console=plain` succeeds after USB reconnection. Launch returns `Status: ok`. Final optimized APK was installed and launched.

## Device performance

Requirement: **≥25 result FPS and ≤25 ms inference**.

| Run | Conditions and changes | Observed result | Gate |
|---|---|---|---|
| 1 | Original single-frame GPU implementation; model input allocated each submission | After startup, roughly 6–16 FPS / 43–180 ms sampled inference; hands detected in some results | Fail |
| 2 | Reused model input; skipped conversion while busy; app backgrounded between builds | After five initial logged windows: 20 windows, **8–11 FPS / 45–92 ms** sampled inference, **96 ms** worst window latency; 2 windows with a hand | Fail |

FPS is a rolling count of result callbacks in the preceding second, including no-hand results. Inference is elapsed monotonic time from `detectAsync` submission to result handling; it excludes camera conversion/letterboxing. Logs are emitted about once per second and include the maximum callback latency in the rolling window. The 45–92 ms range describes those logged samples, not every frame. The second probe requires every retained window to meet FPS and maximum-latency budgets.

The phone reported thermal status 1 (light throttling) during run 1. No controlled unthrottled comparison was made, so the cause of the shortfall is not established. The hand-count changes establish that the model returns both hand and no-hand results; they do **not** establish correct dot alignment or disappearance on screen.

Only the app's numeric tracking logs were read. No camera screenshot, recording, frame, landmark coordinates, or user content was exported. The exact second-probe command and its final output are preserved under [D1-T7c in progress.md](../progress.md#blockers).

## Remaining acceptance and next action

- User confirmation: dot follows the index fingertip in portrait and landscape and disappears when the hand leaves view.
- Confirm the added preview/debug content does not create extra TalkBack elements.
- Resolve the performance shortfall, then rerun the documented build/test/install and device acceptance. Do not reduce the target, change pinned dependencies, or claim a faster phone is necessary without investigation.
- Two unsuccessful performance attempts are recorded. AGENTS.md §9 requires stopping further attempts and task progression here. T7d remains unstarted.
