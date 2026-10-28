# D1-T7d tone prototype — 2026-10-28

**D1-T7d complete within its prototype scope.** The user explicitly requested proceeding to T7d while leaving T7c unfinished. T7c remains blocked and none of its performance or regression checks are marked complete.

## Implementation

- `ToneGenerator` is pure JVM logic in `core:guidance`. It generates 48 kHz stereo float PCM in 240-frame blocks, preserves phase, and ramps frequency, pan and start/stop gain over 5 ms. Equal-power panning and amplitude 0.25 follow the plan and guidance spec.
- `ToneSynth` owns AudioTrack on one audio-priority thread. Atomic controls make its public methods thread-safe; short writes are completed. Audio initialization failures expose a plain retry instruction. Lifecycle stop/disposal releases output; creating a screen without enabling the tone does not open AudioTrack.
- The one session action toggles the tone, exposes its on/off state and retains the existing TalkBack description. Valid fingertip samples drive the plan's temporary horizontal mapping. Missing/invalid hands and camera/tracker errors mute output. This is a prototype, not target-based guidance or the closed-loop application.
- The explicit mapping raises pitch as image x increases; the plan's contradictory "left" check was corrected to "right". Target-error mapping remains later work.

## Automated validation

```bash
./scripts/android.sh :core:guidance:test --tests '*ToneGeneratorTest' --console=plain
./scripts/android.sh :core:guidance:test :app:test :app:assembleDebug :app:lintDebug --console=plain
```

The first command confirmed **12 expected TODO failures before implementation**. After implementation, **all 37 guidance tests pass**, with 0 failures/errors/skips. The tests cover pitch/phase continuity, linear ramps, interrupted ramps and split buffers, equal-power stereo, muted channels, silence, invalid inputs, clamping and the prototype mapping. The app unit-test task has no source cases. Debug build and lint pass; lint retains 0 errors and 4 existing advisories. No test was weakened or dependency changed. APK ZIP integrity passes; the APK is installed on both connected Android test phones.

These checks establish the generated signal. They do not measure acoustic latency or prove that a particular output device receives a low-latency path.

## Device acceptance

| Requirement | Result |
|---|---|
| Pitch follows the documented mapping and stereo pan follows the dot | Pass: user confirmed the tone, pitch and stereo pan all work with the requested earphone/TalkBack procedure |
| Start/stop and control changes have no audible clicks | Pass: user confirmed all repeated-toggle and change checks |
| TalkBack double-tap toggles the tone | Pass: user confirmed off/on toggling with TalkBack enabled |
| Perceived response latency recorded | User reports that response feels prompt; this is subjective, not a measured millisecond result |
| Hand removal mutes output; background stops audible output | Pass: user confirmed silence without a hand and after Home, and correct behavior after returning |

Read-only device state corroborates TalkBack enabled and AudioTrack initialization at 48,000 Hz, buffer size 3,848 frames and performance mode 1 (low latency). This reports the platform configuration, not a measured acoustic delay. No audio was recorded.

The implementation releases AudioTrack on lifecycle stop. Manual background silence passed; native resource/thread teardown was not independently measured. T7d acceptance does not establish the complete frame-to-cue performance budget or waive T7c's failed tracking gate.

Use stereo earphones to check left/right pan. With TalkBack enabled, open Fingerpost, show a pointing hand and double-tap to turn the tone on. Move the dot from the middle toward the right, then across the preview. Toggle off/on, remove/return the hand, and report any clicks or noticeable delay. No camera frames or audio recordings are needed for acceptance.
