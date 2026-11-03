# Diagnostic handoff — 2026-11-04

## Saved changes

- `scripts/profile-android-tracking.py` now matches A4-0 production defaults: GPU with one hand. Its `--check-budget` guard requires that profile; the 25 FPS / 25 ms gate is unchanged.
- `services/gateway/src/debug/transport-counters.ts` adds content-free inbound counters, exposed only by local **mock** `pnpm dev:phone` at `/v1/debug/transport-counters`. It records no payload bytes, image/audio content, OCR, transcript, text, digit values, device identifier, or session identifier.
- Regression coverage covers the one-hand profiler guard/default, counter transitions, mock endpoint presence, and its absence from the local live gateway.

## Completed checks

- Gateway tests: **546/546 passed**.
- `pnpm --filter @fingerpost/gateway typecheck` passed.
- `python3 -m unittest scripts/test_profile_android_tracking.py`: **24/24 passed**.
- `git diff --check` passed.

These are focused code checks only; no full-suite or physical acceptance is claimed.

## Confirmed build/runtime facts

- The installed APK SHA-256 exactly matched `apps/android/app/build/outputs/apk/debug/app-debug.apk` at this workspace state. Package version alone was not used as provenance.
- `TrackingOptions` production default is GPU / one hand. The earlier GPU / two-hand capture used debug intent overrides.

## Still NOT RUN

- Cold (thermal status ≤1) GPU / one-hand physical profile and synthetic-keypad lock-retention trial.
- Physical PIN transport-counter observation across entry, active PIN mode, and exit.
- Physical earphone-disconnect check that confirms digit speech never routes to the speaker.

## Resume commands

Keep the phone unlocked, USB-debug authorized, and do not run a live gateway or paid model call.

```bash
ADB=/home/meer/Android/Sdk/platform-tools/adb \
  python3 scripts/profile-android-tracking.py --delegate GPU --hands 1 \
  --warmup-seconds 5 --seconds 15 --check-budget

pnpm dev:phone
curl -s http://127.0.0.1:8080/v1/debug/transport-counters
```

Run the profile only after the operator has cooled the phone; record camera FPS, tracker FPS, inference latency, thermal status, and synthetic-keypad lock retention separately. The profiler deliberately launches the debug intent profile; omit `--hands 2` unless explicitly comparing diagnostics.

For the counter trial, start a fresh mock gateway so all counters begin at zero. Establish a normal pre-PIN upload, enter the synthetic keypad PIN mode, keep it active while moving the finger, then remove the keypad and wait for PIN exit before reading the endpoint. Expected safety evidence is `pinEntered >= 1`, `pinExited >= 1`, `pinActive: false` after exit, and **zero** `audioChunksWhilePinActive`, `audioEndsWhilePinActive`, and `keyframesWhilePinActive`. The non-PIN totals may be nonzero; they prove only that the connected session was observed. Any positive `*WhilePinActive` counter is a failed boundary observation, not an accepted result.
