# Day 1 completion audit — 2026-10-28

**Snapshot notice:** implementation descriptions and test counts below refer to the dated audit. Later incoming Android/gateway integration is inventoried in [the sync report](repository-sync-2026-10-30.md). [Testing through D2-T7 on 2026-10-30](through-day2-t7-2026-10-30.md) records working live model access, integration results and the remaining acceptance gates. Earlier missing-key and unimplemented-pipeline statements are historical.

**Decision: Day 1 is not complete. The user subsequently explicitly authorized starting Day 2 despite these unfinished requirements; no Day 1 check is waived or marked passed.** Eight of the 12 original Day 1 tasks are complete within their documented scope; four remain incomplete. One of the five Day 1 exit checks passes. These counts are checklist results, not an estimate of product completion.

Implementation audited: gateway/evaluation/deployment fixes in `5d4a5aa`/`a27887d` and tracking-tool/CI fixes in `d0a4ed3`, on `main`. Existing audit drafts were preserved and updated. This pass includes implementation fixes as well as documentation; it does not claim live or device acceptance. It compares [the Day 1 plan](../superpowers/plans/2026-10-27-day1-foundations.md), [the completion rules](../../AGENTS.md), specifications, active implementation, tests, build outputs, CI and previously recorded device acceptance. Plan assets alone do not count as implemented features. Local checks below were executed during this audit; historical checks are identified separately.

The additional **D2-T1 Kotlin protocol foundation is complete** and was pulled forward to satisfy Day 1 CI's existing protocol-test requirement. It is not one of the original 12 Day 1 tasks. Including that foundation, the current Day 1 board has nine completed rows and four blocked rows. D2-T2/T3 were subsequently implemented under that user exception; see the follow-up below.

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
| D1-T8: CI/tester preparation | **Complete** | Three weekly Dependabot schedules, 45-minute session protocol, bilingual consent/outreach and unsent organization tracker checked. Both CI jobs pass at audit revision 2480252; original checks and the new Python tooling suite are retained. | No T8 checklist gap. Drafts do not satisfy T0's human outreach or later tester booking/trial requirements. |
| D2-T1: pulled-forward CI foundation | **Complete; additional prerequisite** | Kotlin models/codec and strict framing implemented; 49 JVM protocol tests pass against shared fixtures and added boundary cases. | No foundation gap. It is not an Android network client. |

The user explicitly deferred unfinished T7c to permit T7d. That exception did not waive performance acceptance or complete Day 1. The CI prerequisite correction is recorded in both day plans and [progress](../progress.md#deviations-from-the-plan).

## Day 1 exit checks

| Required exit check | Result | Evidence |
|---|---|---|
| Fingertip tracking ≥25 FPS; T7c also requires ≤25 ms inference | **Fail** | Retained comparison GPU/two-hand run: 10–12 result FPS, 43–86 ms sampled task latency, rolling maximum 87 ms. |
| Correct target polygons on at least 8/10 real panel photos | **Not executed** | No Day 1 JPEG dataset or live smoke/quality report. Adapter fixture tests do not establish this result. |
| ADR-0003 accepted after regional measurement | **Not met** | ADR remains `proposed`, with an empty result section; no regional evidence recorded. |
| Simulator verified on the Android tablet | **Not verified** | Required physical tablet acceptance has no recorded result. Desktop checks are insufficient. |
| CI green | **Pass** | [Run 40647979193 at 2480252](https://github.com/Sky-walkerX/fingerpost/actions/runs/40647979193): both `ts` and `android` succeed, including the new Python tooling suite. All original checks remain. |

**Exit tally: one pass, one measured tracking failure and three unfulfilled checks.**

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
gh run watch 40647979193 --interval 15 --exit-status
gh run view 40647979193 --json jobs,conclusion,headSha,url
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

The exact-revision CI result independently confirms frozen-lockfile install, recursive TS checks, all 27 Python tooling tests, both JVM module tests and debug APK assembly at 2480252. The subsequent evidence update changes documentation only. CI does not currently perform tablet/device acceptance, live model evaluation or app instrumentation tests.

The following evidence was reviewed, **not repeated**: shell acceptance in [day1-app-shell.md](day1-app-shell.md); camera/performance/keep-awake evidence in [day1-device.md](day1-device.md) and [day1-tracking-profile.md](day1-tracking-profile.md); listening acceptance in [day1-tone.md](day1-tone.md). Historical test counts in those reports describe their earlier builds.

## Findings and closure requirements

1. **T0 human prerequisites are unverified.** Local `.env` is absent, the Day 1 dataset contains zero JPEGs, and outreach is unsent. Local absence does not prove external accounts do not exist. A human must confirm setup and make credentials available privately; engineering then verifies the configuration. Raw photos and consent records must stay out of commits.
2. **T5 engineering preparation is implemented and synthetically verified.** Real photos and overlays stay in ignored local storage; only anonymous numerical outcomes enter the committable report. All input JPEG dimension headers are checked before paid calls; this is not full image decoding. Reports explicitly require manual correctness scoring and label pricing as an estimate. CLI and debug model errors are content-free. The regional tool rejects invalid arguments, non-2xx HTTP and nonnumeric/extra response fields, disables redirects and reports actual debug-request round trips without printing a partial comparison. The deployment script/config and source exclusions are prepared; five stubbed tests pass. No real cloud build/deploy or model call has run. T5 is still partial, with only Step 3 complete.
3. **T5 selection wording is aligned with ADR-0003; measurement evidence remains missing.** Step 7 now requires total keyframe-to-target p50 instead of RTT+Spark alone. The debug endpoint still uses a fixed SAM box, so its measured round trip is a diagnostic proxy. The subsequent measurement-tooling implementation below adds ASR accepted-handshake and controlled binary-target capability; live evidence is still unmeasured. Do not accept the ADR from proxy figures or sums of independent percentiles; no region is chosen.
4. **T6 needs the specified tablet checks.** A human makes a tablet available and participates in acceptance; engineering handles defects and records each required result. Do not mark it complete from simulator unit tests or phone/desktop browser results.
5. **T7c has an unresolved measured failure.** Camera analyzer delivery was about 29–31 FPS, while results were 10–12 FPS. Task latency measures submission to MediaPipe listener entry, including SDK work; it is not isolated GPU-kernel time. Both retained full comparison runs had thermal status 1. CPU/no-hand and GPU/pointing-hand runs used different scenes and cannot establish a delegate ranking. Interrupted one-hand captures were discarded. Hardware, native-task processing and thermal contributions remain unresolved; a phone change is not a proven fix. This pass fixed a separate acceptance-tool defect: CPU diagnostics, unknown/asleep screen state and insufficient logged windows can no longer pass GPU acceptance. It did not fix tracking speed or the log-stream termination cause. With zero devices connected, no new performance attempt or visual/accessibility check could run. Resume with reliable capture and a controlled cold one-visible-hand comparison of GPU one/two-hand modes, then finish the unchanged production performance and regression checks. One-hand diagnostics alone cannot complete T7c.

## Next actionable work

The user has since restored Day 1 completion as the priority; further Day 2 work is on hold. Unfinished Day 1 work remains: T0 human setup/private photos, T5 live quality/deployment/regional evidence, T7c unthrottled performance and deferred manual regression, and T6 tablet acceptance. The phase exception changes ordering only; record Day 1 complete only after its required evidence exists.

## Subsequent USB reconnect — 2026-10-28

The prior zero-device finding above describes the audit snapshot. The user subsequently connected one authorized USB phone; the installed APK matches the current local build. A red-first profiling transport change uses explicit non-PTY ADB shell execution, preserving PID/main-buffer/tag restrictions and early-EOF rejection. All 24 tracking-tool and five deployment-tool tests pass locally. Two full capture windows now complete, including the first retained GPU/one-hand diagnostic.

Both new runs report severe thermal status 3: GPU/one hand reaches 9–12 FPS / 52–109 ms, with intermittent hand loss; GPU/two hands reaches 5–8 FPS / 107–167 ms, rolling max 167 ms, and fails the unchanged gate. This is no unthrottled or isolated hand-count comparison. The camera session was stopped; the user postponed the fused visual/TalkBack regression. No Android production code, model, dependency, threshold or completion count changed. Next T7c work remains a controlled unthrottled/native-task investigation and the deferred manual checks. See the [profiling report](day1-tracking-profile.md) for exact conditions and numeric evidence.

## User-directed Day 2 start — 2026-10-28

The user requested "Start implementing Day 2 now" after being told Day 1 is incomplete. D2-T2 and T3 are now complete in their pure Kotlin scope, following failing-first runs and preserving the finished assets and original tests. All 85 guidance tests pass; the protocol check and Android compatibility build succeed. No new closed-loop app feature, live model acceptance or Day 1 completion is claimed. D2-T4 is blocked before implementation because its plan/test uses a fixed 1.5-second DONE timeout while guidance-spec §8 waits for speech completion; the user has been asked to resolve this under AGENTS.md §4.

CI at [caf62d0](https://github.com/Sky-walkerX/fingerpost/actions/runs/40653225580) passes both jobs, including all 85 guidance and 49 protocol cases, TS/tooling checks and Android debug assembly. This validates the Day 2 core changes without completing any missing Day 1 device/live check.

## D1-T5 measurement coding — 2026-10-28

The user explicitly requested the remaining measurement coding. The ASR probe now distinguishes WebSocket upgrade from accepted handshake, sends no audio and retains only timing. The private benchmark sends an existing fp.v1 binary keyframe and receives a validated target after exact-label selection and SAM. The two-region CLI reports directly observed totals and refuses live ranking for mock/short/incomplete comparisons. No public protocol/schema/Kotlin model or dependency changed; the general Day 2 session flow is still unimplemented.

Fresh verification passes 143 gateway cases and 205 total TS cases, recursive typechecks/builds and actual localhost native-socket integration. The compiled gateway also passes two mock target exchanges. These 49 added cases do not replace the original tests. See [scope, commands and evidence](day1-region-tooling.md). The task remains 1/8 live-checklist steps complete: no cloud deployment, real Meta call, manual image-quality result, 20-sample regional evidence or accepted ADR is claimed. Day 1 completion counts are unchanged.
