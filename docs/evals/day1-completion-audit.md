# Day 1 completion audit — 2026-10-28

**Decision: Day 1 is not complete. Do not advance to the Day 2 closed-loop phase.** Eight of the 12 original Day 1 tasks are complete within their documented scope; four remain incomplete. One of the five Day 1 exit checks passes. These counts are checklist results, not an estimate of product completion.

Implementation audited: gateway/evaluation/deployment fixes in `5d4a5aa`/`a27887d` and tracking-tool/CI fixes in `d0a4ed3`, on `main`. Existing audit drafts were preserved and updated. This pass includes implementation fixes as well as documentation; it does not claim live or device acceptance. It compares [the Day 1 plan](../superpowers/plans/2026-10-27-day1-foundations.md), [the completion rules](../../AGENTS.md), specifications, active implementation, tests, build outputs, CI and previously recorded device acceptance. Plan assets alone do not count as implemented features. Local checks below were executed during this audit; historical checks are identified separately.

The additional **D2-T1 Kotlin protocol foundation is complete** and was pulled forward to satisfy Day 1 CI's existing protocol-test requirement. It is not one of the original 12 Day 1 tasks. Including that foundation, the current Day 1 board has nine completed rows and four blocked rows. No other Day 2 feature task is complete or started.

## What currently works

The Android prototype requests camera permission, opens app settings, tracks fingertips locally, draws their positions and generates a controllable stereo tone. Its visible window stays awake. The pure JVM modules provide cue calculations, image-coordinate transforms, the tone generator and protocol models/framing.

The TypeScript gateway validates WebSocket sessions and implements Spark/SAM adapters. Its active session route constructs a `SessionHub` without model-pipeline handlers; it does not yet turn a user's goal into guidance. The app has no gateway session client or microphone implementation. The web application supplies practice fast-food and PIN-pad scenes and tap logs; it is supporting test infrastructure for the Android product. End-to-end target guidance, press verification, authentication and Android PIN protection are later, unimplemented work.

## Every Day 1 task

| Task | Verdict | Implementation and evidence | Requirement still open |
|---|---|---|---|
| D1-T0: human setup | **Incomplete** | Android tooling is installed and usable; only 1/8 top-level setup items is checked. | Meta access/credits, partner credits, GCP/Firebase/billing/budgets, regional registries, name checks, at least 10 panel photos and actual outreach to at least 10 eligible groups lack completion evidence. |
| D1-T1: workspace | **Complete within scope** | Pinned workspace configuration, lockfile, CI definition and community documents exist; current TS checks/builds pass. | None for T1. Its explicitly permitted placeholder security contact still needs replacement before release. |
| D1-T2: TypeScript protocol | **Complete** | `frame.ts` and `parse.ts` implement framing, strict UTF-8, size/error ordering and unknown-server handling. All 48 tests, typecheck, build and JSON Schema export pass. | None for this contract-package task. |
| D1-T3: gateway foundation | **Complete** | Config validation, hello-first session dispatch, error responses and health route are implemented. All 14 app/session tests pass. A fresh container build verifies mock health, debug validation and non-root execution. | None for foundation scope. The later model session pipeline and authentication are not implied by this status. |
| D1-T4: Spark/SAM adapters | **Complete within scope** | Actual request construction, Spark output validation/normalization, SAM mask selection and polygon conversion are implemented. The original 43 gateway tests remain passing within the expanded 94-test suite, using synthetic fixtures/stubs. | No T4 checklist gap. Live service behavior, quality, latency and cost belong to T5 and remain unverified. |
| D1-T5: live smoke/deployment/region | **Incomplete** | Safe evaluation scripts/debug endpoint and offline-tested deployment orchestration are prepared; Step 3 is complete (1/8 steps). | Real dataset/private latency sample, live calls, manual quality scoring, cloud CLI/secrets/services, actual regional deployments, Voice Transcribe/complete target-flow measurements and accepted ADR-0003. See findings below. |
| D1-T6: simulator | **Incomplete** | Hit testing, event logging and transitions are implemented; 14 tests and production build pass. Desktop scene checks were recorded previously. | Physical Android tablet: first-tap fullscreen, complete fast-food flow, three-finger 1.5-second export with one event per tap/element IDs, and scrambled PIN layout at seed 3. |
| D1-T7a: Android foundation | **Complete** | Pinned Gradle/JVM project, cue math and filtering implemented. Its original 12 tests remain intact; the expanded guidance suite has 37 passing tests. | None for this task. |
| D1-T7b: app shell | **Complete within shell scope** | Permission request/denial announcement, app-settings intent, lifecycle permission refresh, accessible theme and single session action are implemented. Prior user/device acceptance covers all shell checks; debug build passes. | No original shell gap. That acceptance predates the camera changes; the fused camera/TalkBack regression remains explicitly open in T7c. |
| D1-T7c: camera/fingertip | **Incomplete; performance fails** | CameraX, MediaPipe GPU/two-hand tracking with CPU fallback, overlay, fused transforms and numeric diagnostics are implemented. Model integrity and automated checks pass. Acceptance-tool gaps are fixed, but performance is unchanged. Earlier visual following was user-confirmed. | Required ≥25 result FPS and ≤25 ms task latency is unmet. Optimized portrait/landscape following/disappearance and single TalkBack element still need regression confirmation. Final task-completion step remains open. |
| D1-T7d: tone prototype | **Complete within prototype scope** | AudioTrack output, thread-safe controls, phase-preserving generator and 5 ms generated ramps implemented. Twelve tone tests pass. User confirmed pitch/pan, click-free toggling, TalkBack operation, no-hand/background silence and prompt perceived response. | No prototype checklist gap. Acoustic latency and actual wall-clock control latency were not instrumentally measured; generated ramps and subjective response do not prove the complete guidance latency budget. |
| D1-T8: CI/tester preparation | **Complete** | Three weekly Dependabot schedules, 45-minute session protocol, bilingual consent/outreach and unsent organization tracker checked. Required CI jobs passed at the prior recorded revision; the new fixes are awaiting their own remote run. | No T8 checklist gap. Drafts do not satisfy T0's human outreach or later tester booking/trial requirements. |
| D2-T1: pulled-forward CI foundation | **Complete; additional prerequisite** | Kotlin models/codec and strict framing implemented; 49 JVM protocol tests pass against shared fixtures and added boundary cases. | No foundation gap. It is not an Android network client. |

The user explicitly deferred unfinished T7c to permit T7d. That exception did not waive performance acceptance or complete Day 1. The CI prerequisite correction is recorded in both day plans and [progress](../progress.md#deviations-from-the-plan).

## Day 1 exit checks

| Required exit check | Result | Evidence |
|---|---|---|
| Fingertip tracking ≥25 FPS; T7c also requires ≤25 ms inference | **Fail** | Retained comparison GPU/two-hand run: 10–12 result FPS, 43–86 ms sampled task latency, rolling maximum 87 ms. |
| Correct target polygons on at least 8/10 real panel photos | **Not executed** | No Day 1 JPEG dataset or live smoke/quality report. Adapter fixture tests do not establish this result. |
| ADR-0003 accepted after regional measurement | **Not met** | ADR remains `proposed`, with an empty result section; no regional evidence recorded. |
| Simulator verified on the Android tablet | **Not verified** | Required physical tablet acceptance has no recorded result. Desktop checks are insufficient. |
| CI green | **Prior pass; new revision pending** | [Run 40616491789 at 5d002e7](https://github.com/Sky-walkerX/fingerpost/actions/runs/40616491789) passed both jobs. New local fixes retain all original checks and add Python tooling tests; their remote run remains to be checked. |

**Exit tally: one previously verified CI pass, one measured tracking failure and three unfulfilled checks. New fixes need their own CI run before closure.**

## Validation executed for this audit

TypeScript commands used the installed Node 24 runtime and pnpm 11.10.0 from [the local development setup](../local-development.md).

```bash
pnpm -r typecheck
pnpm -r test
pnpm -r build
pnpm --filter @fingerpost/protocol schema
./scripts/android.sh :core:guidance:test :core:protocol:test :app:test :app:assembleDebug :app:lintDebug --console=plain
./scripts/android.sh :core:guidance:test :core:protocol:test --rerun-tasks --console=plain
python3 -m unittest discover -s scripts -p 'test_*.py' -v
bash -n infra/deploy-gateway.sh
```

| Check | Observed result and limit |
|---|---|
| TypeScript | 156 current test cases pass: protocol 48, gateway 94, simulator 14. The 51 new gateway cases cover JPEG/smoke privacy, debug-route failures, CLI redaction and regional measurements. Recursive typecheck, all three package builds and schema export succeed. |
| Kotlin JVM | Forced execution passes: guidance 37 and protocol 49; XML reports contain zero failures, errors or skipped tests. |
| Android app | Debug build/lint command succeeds, using up-to-date outputs. `:app:test` has **no source cases**; it does not provide Android UI/lifecycle test coverage. Lint report contains zero errors and four warnings. |
| Diagnostic tooling | 27 synthetic Python tests pass: 22 tracking-tool cases and five stubbed deployment cases. These validate tooling; no real cloud command or new phone benchmark was performed. |
| Model/APK integrity | Model is 7,819,105 bytes; SHA-256 `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`. APK ZIP integrity passes and its bundled model matches. This does not establish speed or device acceptance. |
| Test preservation | All 12 existing test files applicable from Day 1 assets and the pulled-forward Kotlin protocol assets match their supplied tests byte-for-byte. Added tests remain present. No active TODO skeleton or disabled/focused test marker was found in the application test/source scan. |
| Tester materials | Unchanged T8 materials reviewed: YAML parses with all three weekly ecosystems; agenda totals 45 minutes; bilingual consent uses headings/paragraphs without tables. Prior verified word counts remain DM 71/75, email 170/192, Reddit 178/197. All organization/channel rows remain unsent. |
| Gateway container | Fresh build of the same Dockerfile passes: mock `/healthz`, numeric debug metrics, invalid-sample 400, runtime UID 1000. Verification container removed. No live model calls. |
| Deployment preparation | Script syntax and Cloud Build/CI YAML parse; five command-stub tests verify both regions, same-image deployment, invalid/dirty checkout rejection and failure propagation. Real gcloud CLI execution is not verified. |
| Local prerequisites | `.env` absent; no Meta key in the current environment; zero Day 1 JPEGs; gcloud absent on PATH. Sanitized ADB inventory reports zero connected devices. No credential values or device identifiers were retained. |
| Secret-file check | No forbidden credential/keystore file paths are tracked. This is a filename check, not a comprehensive secret or security audit. No credential contents were read. |

The prior CI result independently confirms its frozen-lockfile install, TS/JVM checks and debug APK assembly. Current local validation covers the fixes above; remote validation of those changes is pending. CI does not currently perform tablet/device acceptance, live model evaluation or app instrumentation tests.

The following evidence was reviewed, **not repeated**: shell acceptance in [day1-app-shell.md](day1-app-shell.md); camera/performance/keep-awake evidence in [day1-device.md](day1-device.md) and [day1-tracking-profile.md](day1-tracking-profile.md); listening acceptance in [day1-tone.md](day1-tone.md). Historical test counts in those reports describe their earlier builds.

## Findings and closure requirements

1. **T0 human prerequisites are unverified.** Local `.env` is absent, the Day 1 dataset contains zero JPEGs, and outreach is unsent. Local absence does not prove external accounts do not exist. A human must confirm setup and make credentials available privately; engineering then verifies the configuration. Raw photos and consent records must stay out of commits.
2. **T5 engineering preparation is implemented and synthetically verified.** Real photos and overlays stay in ignored local storage; only anonymous numerical outcomes enter the committable report. All input JPEG dimension headers are checked before paid calls; this is not full image decoding. Reports explicitly require manual correctness scoring and label pricing as an estimate. CLI and debug model errors are content-free. The regional tool rejects invalid arguments, non-2xx HTTP and nonnumeric/extra response fields, disables redirects and reports actual debug-request round trips without printing a partial comparison. The deployment script/config and source exclusions are prepared; five stubbed tests pass. No real cloud build/deploy or model call has run. T5 is still partial, with only Step 3 complete.
3. **T5 selection wording is aligned with ADR-0003; measurement evidence remains missing.** Step 7 now requires total keyframe-to-target p50 instead of RTT+Spark alone. The debug endpoint still uses a fixed SAM box, so its measured round trip is a diagnostic proxy. Voice Transcribe connection timing and the complete target flow are unimplemented/unmeasured. Do not accept the ADR from proxy figures or sums of independent percentiles; no region is chosen.
4. **T6 needs the specified tablet checks.** A human makes a tablet available and participates in acceptance; engineering handles defects and records each required result. Do not mark it complete from simulator unit tests or phone/desktop browser results.
5. **T7c has an unresolved measured failure.** Camera analyzer delivery was about 29–31 FPS, while results were 10–12 FPS. Task latency measures submission to MediaPipe listener entry, including SDK work; it is not isolated GPU-kernel time. Both retained full comparison runs had thermal status 1. CPU/no-hand and GPU/pointing-hand runs used different scenes and cannot establish a delegate ranking. Interrupted one-hand captures were discarded. Hardware, native-task processing and thermal contributions remain unresolved; a phone change is not a proven fix. This pass fixed a separate acceptance-tool defect: CPU diagnostics, unknown/asleep screen state and insufficient logged windows can no longer pass GPU acceptance. It did not fix tracking speed or the log-stream termination cause. With zero devices connected, no new performance attempt or visual/accessibility check could run. Resume with reliable capture and a controlled cold one-visible-hand comparison of GPU one/two-hand modes, then finish the unchanged production performance and regression checks. One-hand diagnostics alone cannot complete T7c.

## Next actionable work

Remain in Day 1. Human T0 setup/private photos and test-device availability are now the immediate prerequisites. Engineering then runs the prepared live smoke and manual quality review, verifies real deployment, supplies the missing regional measurement capability/evidence, and resumes the controlled T7c investigation. T6 needs its actual tablet checks. No Day 2 closed-loop task is started. When each task's required evidence exists, run its final verification and only then change its status; all five exit checks must be satisfied before the general Day 2 phase starts.
