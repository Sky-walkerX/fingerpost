# Day 2 implementation and local verification — 2026-10-31

The user requested completion of Day 2 implementation, using local testing where possible and deferring GCP-only checks. Existing implementations were read and retained; missing integration behavior was repaired. **Local coding checks pass. Day 2 acceptance is not complete.** The current live full-frame probe failed, and device, real-data and human checks below remain open.

**Subsequent physical-phone check:** a connected device exposed a PIN-gate regex crash that the JDK tests missed. Fixed and verified with eight failing-first/passing Android instrumentation checks; JVM total is now 214. The app runs camera/OCR after repair, but severe thermal throttling returns and full device acceptance remains open. See [device results](day2-device-2026-10-31.md); the zero-device observations in the original audit below are historical.

## Implementation reviewed and repaired

| Task | Implementation evidence | Remaining acceptance |
|---|---|---|
| T1–T6 | Kotlin codec/guidance/state machine and gateway resolution/pipeline are implemented. Existing tests retained; complete suites pass. | These tasks retain their previously completed scope. |
| T7 | Controller, ASR and simulator relay are wired. Fixed simulator browser CORS without granting credentials or CORS to auth/debug routes. Live simulator token enforcement remains intact. Mock ASR now endpoints from incoming audio, avoiding the phone/server end-of-input deadlock; cancellation and repeated end are safe. | GCP deployment/ADR-0003 deferred. Current live full-frame result still needs a successful repeat. |
| T7/full-frame path | Spark parse and SAM screen detection run concurrently. A full image gets a content-oriented `screenQuad`; elements and refined masks are projected from image coordinates into that screen plane. SAM box prompts retain their original image-pixel coordinates. Device-quad fallback, degenerate geometry, clipping, rotation, no-mask target fallback and canceled-call usage are covered. | Real perspective/camera quality and provider latency are not established by synthetic geometry tests. |
| T8 | Dataset validation, metrics, evaluator, safe CLI and anonymous reports are implemented. The documented mock baseline reruns with 50% target hit rate. | Ten private public-source JPEGs exist; independently reviewed `labels.json` does not. Real labels/live baseline remain outstanding. |
| T9 | Incoming ticket/cooktop scenes and `postTouch` are implemented. All supplied scene tests pass. Actual desktop browser language/destination/quantity taps produce three matching gateway `sim.touch` deliveries. | Required Android tablet check remains unperformed; desktop testing does not complete it or D1-T6. |
| T10a–c | Screen estimator/KLT tracking, session/mic/keyframer, engine, speech/tone/haptics and lifecycle code are present and compile. Fixed subsequent locate uploads to use a screen crop after the first server anchor. Tracking analysis now fits within 640×360 in either orientation. Corrected camera pitch to use both in-plane gravity axes, preserving wording when the phone is rolled. | No authorized or unauthorized ADB devices detected. Quad lock/pan/hand occlusion, mic/permission behavior, TalkBack, audio/haptics and physical guide → press → verify acceptance await a phone/tablet. |
| T10d | The trial procedure and recording requirements are documented. This is a human/device exit gate, not a missing algorithm to replace with mock scores. | Ten actual proxy trials, at least five successful within 20 seconds, remain unperformed. |
| T11 | Labeler loads local JPEGs, draws/edits normalized boxes, offers protocol roles/types, validates goals and copies evaluator-compatible JSON. Fixed photo/overlay size mismatch, stale image state and malformed/missing goal export. English/Hindi consent now discloses the connected gateway/Meta image/audio flow and separate processing permission. | Human tester bookings remain unrecorded. No invitations sent or consent responses invented. |

The default mock gateway returns a fixed appliance layout and synthetic phrase; it does not recognize a user's speech or camera view. The reusable local scenarios inject ground truth from the actual cooktop/ticket scene builders. They exercise transport and coordination, not physical recognition. Do not treat the default mock fixture as a cooktop vision check.

## Test-first and automated evidence

- CORS/mock ASR: six initial failures, one existing fail-closed case passing, then all seven new checks pass.
- Full-frame geometry: eleven failures confirmed before implementation, then all eleven pass.
- Android capture selection: three TODO failures confirmed, then pass after implementation/wiring.
- Camera pitch: two rotation failures reproduced from the previous portrait-only calculation, then all three cases pass. Guidance-spec §6 remains authoritative; its 55° threshold is unchanged.
- Label export: seven failures and one passing schema/enum contract confirmed, then all eight pass. No supplied test was weakened, skipped or deleted.

| Command | Verified result |
|---|---|
| `pnpm -r test` | **415 passed**: protocol 57, gateway 294, web 28, evaluator 36 |
| `pnpm -r typecheck` | Passed |
| `pnpm -r build` | Protocol, web and gateway passed |
| `pnpm check:day2` | Two actual loopback cooktop/ticket scenarios pass: hello, mock endpointing without audio.end, full-frame anchor/target, unrelated-run isolation, browser-compatible simulator POST, linked press, correlated verify and abort. Zero external calls. Added to CI. |
| `./scripts/android.sh :core:guidance:test :core:protocol:test :app:test :app:assembleDebug :app:lintDebug --console=plain` | Passed; XML totals **154 guidance +53 protocol +5 app =212**, zero failures/errors/skips. New guidance/app changes execute; protocol outputs are up to date. Lint: zero errors/six existing warnings. |
| `python3 -m unittest discover -s scripts -p 'test_*.py' -v` | **31 passed**; deployment checks use stubs, not GCP |
| Mock evaluator CLI | Two fixture items, target hit 50%, precision 40%, recall 80%; no paid call. These are harness results, not quality acceptance. |
| Browser annotation workflow | Actual synthetic JPEG upload/draw/edit/type/export succeeds; exported item passes `LabelFile`. Malformed goal gives visible error; broken replacement image clears output/labels and disables export. |
| `git diff --check` | Passed |

The first remote run at `b751bc0` caught a clean-checkout problem: the labeler test imported the evaluator's protocol schema, but the web Vite config lacked the `source` export condition used by every other workspace. Existing local `packages/protocol/dist` had hidden it. Added the same `resolve` and `ssr.resolve` source conditions; retained the contract test and build-free test order. All 415 tests and both loopback scenarios also pass with protocol build output temporarily removed and restored afterward. No build-before-test workaround, new dependency or skipped check.

## Current live probe

One bounded local check used the existing private Meta credential and a generated synthetic panel; no real camera image or human audio was sent. It exercised the current in-process gateway pipeline/live model adapters and the Voice Transcribe connection probe, not a deployed service or authenticated phone session.

- Voice Transcribe upgrade/accepted handshake: **pass**, zero audio bytes sent.
- SAM `touchscreen display` call: **completed**.
- Spark call: **no successful ParseResult**, diagnostic category `provider_or_response`.
- Target SAM calls issued: **0**; no final target was produced.
- Whole diagnostic: **5,027 ms**. One Spark and one screen-SAM request issued; no SDK retries. Exact upstream cause was not retained, so timing alone is not labeled proof of a timeout.

This is **not a live acceptance pass**. The current five-second/no-retry SDK policy comes from the already implemented B4-0 plan; it was not lengthened or otherwise changed to obtain a passing result. Earlier live evidence predates the full-frame repair/current-policy revalidation and remains historical. No repeated paid diagnostic or new prompt/model/dependency change was made here.

## What completes Day 2 next

1. Resolve/revalidate the live Spark/full-frame target failure under the documented model policy. The later planned router/fallback work is not implemented by this Day 2 repair.
2. Review real-photo truth labels with the labeler, then run the real baseline. Never use model predictions as truth labels.
3. Connect the phone/tablet and complete the [Android handoff checklist](android-integration-handoff.md), tablet relay check and proxy trials.
4. A human books tester sessions using the updated consent. Keep participant records private.
5. Restore GCP access and execute the [deferred cloud checklist](cloud-revalidation.md), including ADR-0003 and deployed auth/quota/kill-switch validation.

No device, real-photo quality, cloud, proxy or release gate is marked passed by local tests. All temporary diagnostic media are synthetic; none are committed.
