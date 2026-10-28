# T7c performance investigation — 2026-10-28

**Outcome: T7c remains blocked.** The user explicitly resumed investigation and provided a second Android test phone. The required GPU/two-hand mode still misses ≥25 result FPS and ≤25 ms inference. No requirement, dependency, model asset, or production hand limit was reduced. A later USB reconnect produced two complete captures through the corrected shell transport; both reported severe thermal throttling and neither establishes unthrottled performance (follow-up below).

**Subsequent scope decision:** the user explicitly deferred unfinished T7c and requested the T7d tone prototype. That work and its separate acceptance are tracked in [the tone report](day1-tone.md); the performance measurements and open T7c checks here are unchanged.

## Implemented

- Added numeric timing for analyzer delivery, bitmap conversion, crop/rotation, model input preparation, task-call latency, submission and callback queue delay. Task latency ends at listener entry; callback dispatch is measured separately. Previously it included that dispatch. Observed dispatch was negligible, so the shortfall was not a measurement artifact.
- Added an optional raw `AnalysisFrame` path to the existing CameraPipeline interface. The tracker draws crop, clockwise rotation, downscale and letterbox in one operation into its reusable 640×480 bitmap. It no longer allocates a full-resolution rotated intermediate on this path. Published landmarks still use the same upright crop dimensions. The original upright-bitmap callback remains available.
- Recycle the **distinct output MPImage** supplied to each MediaPipe callback. Inspection of pinned 1.1.1 bytecode confirmed that it allocates a new Bitmap and that OutputHandler does not close it. The reusable input image remains alive until tracker teardown/fallback.
- Keep the visible camera awake. A comparison run exposed automatic screen sleep; invalid runs produced no results. The initial PreviewView flag was subsequently moved to MainActivity's visible window, covering the permission screen too. It does not override explicit device locking or keep a background camera session alive.
- Added debug-only intent selection of CPU/GPU and one/two hands for controlled comparisons. Release intent overrides are ignored; default configuration remains **GPU, two hands**.
- Added `scripts/profile-android-tracking.py`: standard-library-only developer tooling, bounded warm-up/sample duration, strict numeric parsing, configuration validation, thermal/awake state, optional private device selector and budget check. It reads only the app's main log buffer. No frame, screenshot, audio, landmark coordinates or identifying device information is exported.

## Validation

- Seven fused-transform tests confirmed expected TODO failures before implementation. All **25 guidance JVM tests pass**, 0 failures/errors/skips.
- Diagnostic parser/target/privacy checks were written first; all **18 Python tests pass**. Contradictory timing data cannot pass acceptance; one-hand diagnostics cannot use `--check-budget`.
- `./scripts/android.sh :core:guidance:test :app:test :app:assembleDebug :app:lintDebug --console=plain` passes. App unit-test task has no source cases. Lint retains four advisories; no checks disabled.
- Final optimized APK installed/opened on the comparison test phone. Its model SHA-256 and ZIP integrity pass. APK SHA-256: `4d09555a0ea630bedb6d97ed7c6f1553e4c1836048083abdc2b67320252df901`.
- Previous visual acceptance applies to the earlier build. The fused path still needs user confirmation in both orientations and a TalkBack recheck before task completion.

## Measurements

| Device / configuration | Scene | Result FPS | Sampled task latency | Other evidence |
|---|---|---|---|---|
| Original test phone, GPU/two hands, before fusion | No hands, 22 s capture, first five logged windows omitted | 7–10 | 53–97 ms; median 58.5 ms; rolling max 99 ms | Full-resolution rotation windows reached 32 ms; model input prepare 1–3 ms; callback queue 0 ms |
| Original test phone, CPU/two hands, before fusion | No hands, 5 s warm-up +15 s capture | 7–10 | 55–110 ms; median 74 ms; rolling max 124 ms | Thermal status 1 before/after; no conclusion from this about unthrottled CPU performance |
| Comparison test phone, GPU/two hands, after fusion | Short 4 s diagnostic snapshot with no hands; **not an acceptance run** | 16–18 | 30–41 ms sampled | About 30 analyzer deliveries/s; separate rotation stage 0 ms; fused prepare 2–10 ms; callback 0–1 ms |
| Comparison test phone, CPU/two hands, after fusion/keep-awake | No hands, 5 s warm-up +15 s capture | 11–14 | 45–61 ms; median 52 ms; rolling max 67 ms | Thermal status 1 before/after; awake throughout; budget check **fails** |
| Comparison test phone, GPU/two hands, after fusion/keep-awake | One pointing hand confirmed by user and detected in every retained log sample; 5 s warm-up +15 s capture | **10–12** | **43–86 ms**; median 59 ms; rolling max **87 ms** | About 29–31 analyzer deliveries/s; prepare 2–9 ms; callback 0 ms; thermal status 1 before/after; budget check **fails** |

[Sanitized numeric profiles](day1-tracking-profile-data.json) contain complete valid CLI summaries. Statistics describe periodic log samples; `window_inference_max_ms` also covers the preceding rolling result window. They are not a per-frame latency distribution. Analyzer-delivery FPS is not guaranteed to equal sensor FPS.

The full-size rotation cost is removed by the new path, but the model task still exceeds the budget. These measurements do not establish how much of the remaining cost belongs to native inference, image transfer/readback, or thermals. They also do not establish that a different phone will meet the gate. Thermal status was 0 in an earlier health check and 1 in the retained full comparison runs; a controlled cold pointing-hand comparison remains missing.

## Invalid captures and remaining blockers

- An initial comparison log stream ended early. Restricting logcat to `-b main` worked in a health probe. Another one-hand diagnostic stream later ended early despite that restriction. The app was still running afterward; the cause is unproven. Both interrupted captures are discarded. There is **no valid one-hand performance result**, so the repeated-palm-detection hypothesis remains unproven on this device/version.
- A CPU attempt while the phone was asleep produced no samples and is discarded. The camera now keeps its visible view awake; the CLI rejects a known sleeping phone before launch. The subsequent retained CPU/GPU runs report awake before and after.
- After two valid budget failures in the resumed comparison (CPU/two hands and GPU/two hands), further performance attempts stopped under AGENTS.md §9. T7d was unstarted at that checkpoint and was subsequently authorized separately (see scope decision above). Next T7c work is a controlled unthrottled/native-task investigation and reliable diagnostic capture; acceptance of a reduced hand limit or altered performance requirement would need an explicit project decision.
- The diagnostic one-hand session was force-stopped after capture. The app was then launched without diagnostic extras and backgrounded; previous test sessions were stopped and the private temporary device selector was deleted. No diagnostic setting was promoted to production.

## Reproduce

### USB reconnect and capture transport follow-up — 2026-10-28

- One USB phone is authorized, Camera is granted, and the installed APK's hash matches the current local debug build. ADB selection uses `-d`; no device identifier is saved or reported.
- The direct `adb logcat` probe exited 255 after about 1.9 seconds while the camera was stopped. An explicit `adb shell -T logcat` probe stayed open for 5 seconds and then a full 20-second window with no stderr. The CLI now uses that shell transport without a PTY, retaining the same PID, main-buffer and two-tag filters. This is an observed transport workaround, not proof of the earlier EOF's root cause.
- The command regression failed before implementation. All **24 tracking-tool tests** and **five deployment-tool tests** pass. Added subprocess cases verify numeric-only retention, child cleanup and rejection of early EOF even after valid partial rows. No acceptance threshold or interrupted-capture rejection was weakened.
- While idle with the screen off, thermal status fell from 3 to 2. After the user opened the app and confirmed a fixed, well-lit pointing-hand scene, **both runs reported status 3 before and after capture**. Each completed a 5-second warm-up and 15-second sample window, retaining 14 tracker and 15 camera log windows; both awake checks passed.

| Order / diagnostic | Result FPS | Sampled task latency | Rolling maximum | Detected hands |
|---|---|---|---|---|
| 1: GPU/one hand | 9–12 | 52–109 ms, median 73 ms | 116 ms | 0 or 1 across retained samples |
| 2: GPU/two hands | 5–8 | 107–167 ms, median 135 ms | 167 ms | 1 in every retained sample |

The first run exited 0 as a diagnostic, **not a performance acceptance**. The production GPU/two-hand check exited 1 with `budget_pass: false`. Camera analyzer delivery remained approximately 29–31 FPS, while task submission took 0–3 ms and median callback queue delay was 0 ms. Full numeric summaries and per-run APK hashes are appended to [the profile data](day1-tracking-profile-data.json).

These runs establish successful capture and another failed production speed check. They do **not** isolate the repeated-palm-detection cost: the first mode intermittently lost the hand, the runs were sequential rather than counterbalanced, and the coarse thermal status does not establish equal clock behavior. No one-hand setting was promoted to production. The diagnostic session was force-stopped afterward. The user postponed the fused visual/orientation/disappearance and single-TalkBack-element regression until later; those boxes remain unchecked. A controlled unthrottled comparison and native-task investigation remain necessary; no further speed attempts were made in this follow-up.

### Commands

**Audit follow-up (2026-10-28):** four new synthetic tracking-tool tests reproduced acceptance gaps before correction. `--check-budget` now requires GPU/two hands, confirmed awake state before/after and enough logged windows for the requested duration (one boundary window may be omitted). All 22 tracking-tool tests pass, and CI now runs them plus the five deployment-tool tests. The FPS/latency thresholds are unchanged. CPU and one-hand modes remain diagnostics and cannot pass GPU acceptance. The historical CPU command in progress.md used the earlier checker; omit `--check-budget` for current CPU diagnostics.

No phone was connected during this follow-up, so there is no new speed, thermal, visual or TalkBack acceptance result. Log-stream termination remains unresolved; EOF still rejects the capture. These tooling fixes do not improve or establish tracking performance.

Install the debug APK, grant Camera, unlock the phone and open Fingerpost. With a single USB phone:

```bash
python3 -m unittest discover -s scripts -p 'test_profile_android_tracking.py'
python3 scripts/profile-android-tracking.py --delegate GPU --hands 2 --warmup-seconds 5 --seconds 15 --check-budget
```

With two connected phones, add `--serial-file /tmp/fingerpost-comparison-device`, a private temporary selector prepared locally. Never commit its contents. The CLI reports only numbers and generic configuration. It restarts the app and leaves that selected diagnostic mode foreground; force-stop and launch normally to restore defaults after comparisons.

Exact valid comparison commands and final output are recorded under [progress Blockers](../progress.md#blockers). Camera content stayed on each phone.
