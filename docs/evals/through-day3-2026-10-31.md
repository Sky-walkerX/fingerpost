# Development through Day 3 — 2026-10-31

The user requests the remaining Day 2 work and development through Day 3. Existing code is retained and checked against the plans. GCP testing remains explicitly deferred; current Spark timeout, tracking performance and unperformed human/device gates are not waived. **Day 2 and Day 3 are not fully accepted.**

## D3-T4 implementation

- Added a four-instruction spoken first-launch tutorial, including the spec's screen-relative directions. Matching TTS completion advances it; repeat invalidates the old callback, skip finishes it, and stale completions cannot skip a line. Backgrounding stops speech and returning repeats the current instruction.
- Completion persists in Preferences DataStore. Camera permission/session/capture creation waits until local preferences have loaded and onboarding has completed. Read/write failure gives a plain next action; it does not start capture on failure. One accessible tutorial action supports repeat plus the TalkBack custom action Skip tutorial. A two-finger swipe also skips when delivered to the app.
- Stable quads trigger AF/AE at their centre through the same image-to-preview crop mapping used by the overlay. A five-second refresh matches cancellation; unstable/missing geometry resets it. Unsupported/failed metering leaves tracking running. Existing reacquire/glare/single-session semantics and self-voicing are retained.
- The plan specifies DataStore without a version. Pinned 1.1.7 already existed in this checkout's Android dependency graph; no existing pinned version is upgraded. [DataStore releases](https://developer.android.com/jetpack/androidx/releases/datastore) and [CameraX focus/metering](https://developer.android.com/media/camera/camerax/configuration) were checked against the implemented APIs. The initial five-second refresh is documented in guidance-spec.

Test first: **10 expected tutorial/metering TODO failures** (156 earlier guidance cases still pass), then **two expected persistence TODO failures** (five existing app cases still pass). The implemented versions pass. Tests exercise the real DataStore across close/reopen, not a mock preference map.

```sh
./scripts/android.sh :core:guidance:test :core:protocol:test :app:test :app:assembleDebug :app:assembleDebugAndroidTest :app:lintDebug --console=plain
```

Result: **166 guidance +53 protocol +7 app =226 JVM cases**, zero failures/errors/skips; debug APK, instrumentation APK and lint pass. An initial compilation found the support query belongs to CameraInfo, not CameraControl; corrected it without changing CameraX. Physical tutorial gestures/audibility/persistence, real metering and the required ten-minute TalkBack session are still unverified. No device acceptance is inferred from these local tests.

## D3-T1 Firebase CI completion

The existing OCR/face/keyframer implementation is retained. Added the missing optional GitHub Actions secret preparation. It decodes base64, validates the Android package, writes only a new ignored configuration file with mode 0600, and prints no configuration content. Missing secret preserves the existing Firebase-free build. Four tests fail at the TODO first; after implementation all **35 Python tooling tests** pass. No real Google configuration or credential is supplied, written or committed; Firebase/live device acceptance remains open.

## D3-T6 token/auth verification

Read and retained the existing challenge/auth route implementation. New signed synthetic-token tests expose **six failures/two passes**: missing iat/exp, empty identity, future iat and excessive lifetime. Verification now requires these claims and the documented 900-second window, with the existing HS256/issuer/audience/signature checks unchanged. All eight new cases and **54 selected auth/attestation/quota/revocation cases** pass; recursive TypeScript typecheck is clean. The actual issued-token happy path and expiry boundary still pass. No original test changed, and no new dependency or protocol change.

```sh
pnpm --filter @fingerpost/gateway test token-boundaries attestation auth-routes auth-e2e quota revocation
pnpm -r typecheck
```

These use real cryptographic signatures and synthetic certificate chains/local sockets. They do not replace the required human Google-root fingerprint comparison or actual Firebase/hardware checks. The original source predates this continuation; its initial red history is unavailable and is not invented.

## D3-T8 authenticated socket refresh

The existing Firebase/Keystore client cached a token for 12 minutes but did not refresh an already-connected socket. Added a renewal job for authenticated connections, using the Auth cache's original deadline so reconnects cannot extend it. The timer is canceled on connection loss, explicit reconnect and close; close publishes disconnected. Auth responses must contain a nonempty token, the expected tier and a positive lifetime within 900 seconds.

Two JVM tests use an actual local RFC 6455 upgrade fixture and synthetic tokens: renewal initially fails while the unauthenticated development case already passes. After repair, both pass, including new Authorization data on the renewed connection, no renewal in unauthenticated mode and no requests after close. Test-only deadlines are shortened; production retains the plan's 12-minute refresh/15-minute token values. No Firebase service or device key is simulated as an acceptance pass.

Final Android checkpoint: **166 guidance +53 protocol +9 app =228 JVM cases**, zero failures/errors/skips; debug APK, test APK and lint pass (**0 errors, 7 advisories**). Physical Firebase/hardware attestation/token refresh still needs real setup and remains open.

## Remaining external gates

- Day 2: live Spark/full-frame recognition currently fails with a five-second request timeout; correct touchscreen guidance, tablet/proxy trials and reviewed real-photo labels remain open.
- Day 3: human tech-gate trials, human Google-root fingerprint comparison, actual Firebase/hardware-attestation/Firestore checks, deployment and the 20 real PIN/payment photographs/tester bookings still need their documented prerequisites.
- No account, billing, secret or deployment is created by this continuation. No user media, transcripts, OCR contents or device identities are retained.
