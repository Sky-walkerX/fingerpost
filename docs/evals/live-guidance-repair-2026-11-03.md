# Live guidance repair — 2026-11-03

Scope: D1-T5 / D2-T6 / B4-0 / D7 follow-up requested by the user after public-image diagnostics. The user explicitly chose to keep live recognition with a bounded longer wait and deferred physical-phone testing. This report records coding and limited live integration, not Day 1–7 acceptance.

## Implemented

- Appliance acquisition checks whether the display plane contains the controls instead of blindly preferring a small LCD. At least 80% of each covered control and 80% of controls must lie inside it, including the resolved requested control. Try a qualifying device quad, then one SAM `appliance` concept if needed. The latter recovered the flat-panel sample where display/control-panel concepts returned no mask. Never invent a plane from label-box bounds. Ordinary GUI cropping and sensitive/private routing remain in place.
- A SAM target refinement must have 50–125% of the Spark-box area and at least 80% of its own area within that box. Reject icon fragments, nearby controls and whole-panel masks; keep the Spark box and its confidence. Concave controls remain supported. This does not certify the Spark box's physical accuracy.
- Financial/identity classification latches privacy protection even if no valid screen plane was acquired. Another goal cannot send a later frame back to Meta; route privately or refuse.
- Model response deadlines include SAM stream bodies. Cancellation propagates through the model port and prevents retries/fallback after the turn has stopped.
- Live turns end after 60 seconds, select offline basic mode and suppress late results. The optional `ready.flags.modelWaitMs=65000` supplies five seconds of transport grace. Android uses it for locating, next-task turns, pending explore summaries and verification. Mock/older gateways retain their existing timers. ASK/CONFIRM/PIN and finger/press timings are unchanged. The user decision supersedes the original5-second model-call requirement; configurable 30-second/default calls and zero SDK retries remain.
- Same-turn locate/explore uploads received while one is in flight are coalesced before they become repeated paid parses. New goals, answers and verification retain their ordered processing.

Numbers and behavior are documented in guidance-spec §§2.0,4,8. The compatible ready field is implemented and tested in both TypeScript and Kotlin, with shared positive/negative fixtures. No dependency or pinned-version changes.

## Test-first evidence

Before implementation, new synthetic regressions reproduced 7 geometry failures, 3 model/turn/cancellation failures, 6 protocol failures and 1 duplicate-billing failure. Kotlin wait tests initially failed compilation because the negotiated-wait property did not exist. Review then reproduced an additional privacy failure when sensitive classification preceded screen-acquisition failure; its regression passes after latching classification earlier. Existing tests were retained without relaxed assertions, skips or deletions.

Commands:

```sh
pnpm -r typecheck
pnpm -r test --maxWorkers=2
pnpm -r build
./scripts/android.sh :core:guidance:test :core:protocol:test :app:testDebugUnitTest :app:assembleDebug :app:lintDebug --offline --console=plain
```

- TypeScript: 730 tests (protocol 67, web 53, gateway 544, eval 66); recursive typecheck/build pass.
- Android JVM: 407 tests (guidance 307, protocol 58, app 42); zero failures/errors/skips. Debug APK assembles. Lint:0 errors, 0 fatal issues, 16 existing warnings.
- Restricted execution initially prevented local socket tests/Gradle cache writes; reran with the required local execution permissions. A full-concurrency run also exceeded the existing memory test's 50-ms bound under CPU contention. The full suite passes with two workers; the50-ms assertion remains unchanged.

## Live integration

Public images were resized to 1024 pixels wide and kept below the 409600-byte fp.v1 payload limit. Raw images, recognized labels, goals, model output and overlays stay only in temporary private storage. The source Spark prompt remains `parse-screen.v1`; no contributor model was used.

The final run used a real HTTP/WebSocket gateway bound only to loopback, the existing explicit unauthenticated-live development escape hatch, injected live model adapters and the deterministic guide resolver. Authentication was not bypassed in production code or changed in the private environment. No Firebase/GCP/Modal setup, Cloud Run deployment or phone was involved.

| Sample | Screen acquisition | Result over the live socket | Binary keyframe to response |
|---|---|---|---:|
| A: photographed GUI | Primary display mask | Target; SAM refinement accepted |27,415ms|
| B: photographed flat appliance | Primary display empty; guarded appliance mask recovered the panel | Target; inconsistent SAM refinement rejected, Spark box retained |35,026ms|
| C: blank-display render, negative control | Primary display mask | Ask; no invented requested target |23,267ms|

All three ready messages advertised65,000ms. Nine image requests completed in this final run. These are individual samples, not latency percentiles or a representative accuracy score. The blank render does not count as a real-photo acceptance sample. The appliance target still requires a physical alignment/press trial: returning a target does not prove a correct press.

Exploratory comparisons were separate: an extended Spark prompt worsened GUI button overlap and was rejected; two generic panel concepts returned no mask; a panel-box SAM probe selected an unrelated control; a semantic target query also selected the wrong control and was rejected. None of those prompt/box/semantic alternatives was shipped. The successful appliance concept is used only with the geometric coverage checks.

## Remaining acceptance

- User defers phone connection: install the new APK, use a non-sensitive flat touch panel, verify screen lock, finger alignment, speech/tone direction, actual press and verification. No device success is claimed here.
- Live responses remain much slower than the original 2.5-second first-parse/10-second target-time goals. The longer budget prevents premature retries; it does not make model inference faster.
- Quality on the required real-photo set, tracking performance, PIN/payment acceptance, cloud/auth/regional measurements, signed release and tester gates remain open. No task was reclassified as fully done.
- Credentials/private environment unchanged. No secrets or media added to Git; no commit, push, deployment or release performed.
