# Day 1–7 implementation audit — 2026-11-03

This is a source-and-test audit, not an acceptance report. `Present` means the planned implementation is in source with local regressions; `Partial` means the source exists but a task-specific external result or tester-driven tuning remains. `External` means the plan item is human, device, live, or cloud work rather than missing product code. No `TODO(Dn-Tm)` implementation body remains outside plan assets. The approved five-second/no-retry model bound and hash-only shared-memory rules were retained.

| Task ID | State | Evidence (source / regression) | Remaining coding work | Separate acceptance requirement |
|---|---|---|---|---|
| D1-T0 | External | `docs/local-development.md`; credential paths are intentionally absent | None | accounts, credits, GCP, photos, outreach |
| D1-T1 | Present | root workspace and `.github/workflows/ci.yml` | None | CI remains a service result |
| D1-T2 | Present | `packages/protocol/src/{frame,parse}.ts`; `test/{frame,fixtures}.test.ts` | None | none beyond CI |
| D1-T3 | Present | `services/gateway/src/{config,app,session/hub}.ts`; `test/{app,session}.test.ts` | None | container/host operation |
| D1-T4 | Present | `parse/{spark-parse,sam,geometry}.ts`; `test/{spark-parse,sam,geometry}.test.ts` | None | paid Standard-model quality/latency run |
| D1-T5 | Partial | `scripts/{smoke-runner,region-runner,latency-runner}.ts`; related gateway tests | None independent | keys, live models, regions, deploy, ADR decision |
| D1-T6 | Partial | `apps/web/src/sim/**`; `apps/web/test/sim.test.ts` | None | tablet fullscreen/touch/export check |
| D1-T7a | Present | `core/guidance/{Cues,OneEuroFilter}.kt`; `CuesTest` | None | none beyond Android CI |
| D1-T7b | Present | `MainActivity.kt`, `ui/{SessionScreen,Theme}.kt` | None | regression on installed build as applicable |
| D1-T7c | Partial | `camera/CameraPipeline.kt`, `vision/{HandTracker,ScreenTracker}.kt`; transform/profile tests | no reproducible defect found; do not change thresholds | cold-device performance, portrait/landscape and TalkBack regression |
| D1-T7d | Present | `audio/ToneSynth.kt`; `ToneGeneratorTest` | None | only retained subjective/device evidence |
| D1-T8 | Present | `.github/workflows/ci.yml`, tester/consent/outreach docs | None | human outreach; CI service |
| D2-T1 | Present | `core/protocol/src/**`; `FixtureContractTest`, `FrameTest` | None | none beyond CI |
| D2-T2 | Present | `core/guidance/{Target,Fingertip,Geometry}.kt`; matching tests | None | device wiring is later task |
| D2-T3 | Present | `core/guidance/{Phrases,SpeechQueue,CuePlanner}.kt`; matching tests | None | TTS/device behavior |
| D2-T4 | Present | `core/guidance/GuidanceStateMachine.kt`; state/boundary tests | None | device loop acceptance |
| D2-T5 | Present | `services/gateway/src/resolve/{match,describe}.ts`; match tests | None | live recognition |
| D2-T6 | Present | `services/gateway/src/session/pipeline.ts`; pipeline tests | None | live/device flow |
| D2-T7 | Partial | `session/controller.ts`, `asr/relay.ts`, `sim/registry.ts`; ASR/e2e tests | None independent | current paid live revalidation; cloud deploy |
| D2-T8 | Partial | `evals/src/{evaluate,metrics,dataset,run}.ts`; eval tests | None | real labels/live baseline |
| D2-T9 | Present | web scenes and `sim/net.ts`; scene/flow tests | None | tablet/session relay acceptance |
| D2-T10a | Partial | `vision/{ScreenTracker,QuadEstimator}.kt`; tracker/profile tools | no threshold change justified | real-panel lock, pan, occlusion, thermal profile |
| D2-T10b | Partial | `session/{SessionClient,MicStreamer,Keyframer}.kt`; session instrumentation | None | microphone/keyframe physical run |
| D2-T10c | Partial | `engine/GuidanceEngine.kt`, `TtsSpeaker.kt`, `Haptics.kt`; JVM tests | None | real touchscreen guide/press/verify |
| D2-T10d | External | `docs/tester-protocol.md` | None | consented proxy trials |
| D2-T11 | Partial | `apps/web/src/label/**`; labeler tests, booking docs | None | human booking/real labels |
| D3-T0 | External | `docs/evals/gate-day3.md` procedure | None | human tech gate |
| D3-T1 | Partial | `vision/{Ocr,FaceCover}.kt`, `engine/FrameRouter.kt`; Day 3/native tests | None | device OCR/face/keyframe checks |
| D3-T2 | Partial | `safety/UploadGuard.kt`, `guidance/{PinGate,SafetyPolicy,Keypad}.kt`; safety tests | None | PIN/earphone/two-source device checks |
| D3-T3 | Partial | `guidance/{ScreenChange,Framing}.kt`, `FrameRouter.kt`; Day3 tests | None | physical press/framing checks |
| D3-T4 | Partial | `guidance/{Onboarding,ScreenMetering}.kt`, onboarding store/UI; tests | None | TalkBack/tutorial/focus device session |
| D3-T5 | Partial | `auth/{attestation,google-roots,key-description,revocation}.ts`; attestation tests | None | independent root fingerprint review |
| D3-T6 | Partial | `auth/{challenges,tokens,routes}.ts`; auth/token tests | None | Firebase/hardware auth |
| D3-T7 | Partial | quota/budget modules, `auth-e2e` and Firestore-local tests | None | production Firestore/flags |
| D3-T8 | Partial | `session/Auth.kt`, `SessionClient.kt`; session refresh tests | None | Firebase + hardware attestation device run |
| D3-T9 | External | deploy/region scripts and tests | None | GCP deploy/IAM/regions |
| D3-T10 | Partial | `evals/src/pin-image-export.ts`, web labeler/landing; image-eval tests | None | real corpus, live recall, booking |
| B4-0 | Present | `packages/protocol/fixtures/flows/**`; `flows.test.ts` | None | runtime replay acceptance |
| A4-0 | Partial | `guidance/ThrottlePolicy.kt`, `vision/HandTracker.kt`; throttle tests | None | cold/throttled physical budget |
| A4-1 | Present | `guidance/TaskTurns.kt`, `GuidanceEngine.kt`; task/replay tests | None | device task flow |
| A4-2 | Present | `guidance/SafetyPolicy.kt`, `engine/GuidanceEngine.kt`; policy tests | None | zero wrong-pay physical trials |
| A4-3 | Partial | `engine/{PinMode,PinPlayback,PinAudioOutput}.kt`; playback tests | None | earphone route/disconnect test |
| A4-4 | Present | `guidance/{Strings,Phrases}.kt`, `res/values-{hi,es}`; locale tests | None | installed-voice listen-through |
| A4-5 | Partial | `settings/{Settings,SettingsScreen}.kt`; settings tests | None | TalkBack/font/device persistence |
| B4-1 | Present | `models/{router,port,meta-client}.ts`; router/model-policy tests | None | live fallback/private endpoint |
| B4-2 | Present | `agent/{loop,planner,policy,tools}.ts`; agent/policy tests | None | live/device task replay |
| B4-3 | Partial | `parse/glimmer-parse.ts`, config/phone-dev tests | None | Modal endpoint, credentials, paid/private inference |
| B4-4 | Present | `i18n/strings.ts`; strings/agent-locale tests | None | native-language device listen-through |
| C4-1 | Present | `apps/web/src/sim/scenes/{checkin,adversarial,fastfood,pinpad}.ts`; scenes4 tests | None | tablet acceptance |
| C4-2 | Present | `evals/src/flow-runner.ts`; flow-runner tests | None | no-phone integration is local evidence only |
| C4-3 | External | `docs/tester-protocol.md` | None | consented tester session/triage |
| C4-4 | Partial | `PinImageEvaluation.kt`, `evals/src/pin-image-export.ts`; image/dataset tests | None | physical images + live recall |
| B5-0 | Present | protocol explore/memory flow fixtures; flows tests | None | runtime acceptance |
| A5-1 | Partial | `guidance/TouchExplorer.kt`, `engine/{GuidanceEngine,Earcons}.kt`; explorer tests | None | physical touch-explore |
| A5-2 | Partial | `guidance/LocalLayoutCache.kt`, `memory/DataStoreLayoutStore.kt`; cache tests | None | repeat-screen <0.8s device run |
| A5-3 | Partial | `updates/{UpdateCheck,ReleaseVersion}.kt`, settings/crash config; update tests | tester findings only | Crashlytics/update/device verification |
| A5-4 | Partial | `camera/{FrameSource,MockGlassesSource}.kt`, `ReplayTimelineTest` | None | approved MP4 device/release-flag checks |
| B5-1 | Present | `explore/summary.ts`; explore tests | None | device speech flow |
| B5-2 | Partial | `memory/{simhash,store,service,firestore-store}.ts`, pipeline; memory tests | None; hash-only repair retained | Firestore/trust/device memory acceptance |
| B5-3 | Present | `models/{breaker,router}.ts`; breaker/model-policy tests | None | live provider fallback |
| B5-4 | Present | `services/gateway/scripts/load.ts`; load tests/report | None | sustained environment load confirmation |
| C5-1 | External | tester protocol | None | consented session |
| C5-2 | Present | web privacy/data-safety/install pages; axe tests | None | hosted-page check |
| C5-3 | Partial | `README.md`, `evals/scripts/soak.md` | None | 30-min device soak |
| C5-4 | Partial | Android `donation/{DonationRedactor,DonationUploader}.kt`; gateway `donate/{donation,gcs-store}.ts`; donation tests | None | physical redaction/PIN/consent plus bucket/IAM/lifecycle |
| A6-1 | Partial | `guidance/OfflineResolver.kt`, `offline/{OfflineAsr,OfflineSession}.kt`; offline tests | None | offline language/network/no-upload phone checks |
| A6-2 | Partial | `ui/SessionScreen.kt`, localized resources; a11y matrix | None | Scanner/TalkBack/200% physical audit |
| A6-3 | Partial | localization resources and phrase/strings tests | tester wording only | three-language listen-through |
| B6-1 | Partial | `.github/workflows/release.yml`, app signing config, verify scripts/tests | None | human secrets, signed RC/clean install |
| B6-2 | Partial | `waitlist/**`, `min-version/**`; waitlist/min-version tests | None | Remote Config/Firestore deploy |
| B6-3 | Partial | budget/telemetry modules, `docs/{threat-model,runbook}.md`; tests | None | IAM/monitoring/alerts delivery |
| C6-1 | Partial | `apps/web/index.html`, `src/site/{main,waitlist}.ts`; web tests | None | Firebase Hosting deployment |
| C6-2 | Partial | `docs/video/{script,shots}.md`, synthetic B-roll | None | actual safe footage |
| C6-3 | External | tester/outreach documentation | None | consented tester/X human actions |
| D7 | Partial | `scripts/{release-readiness,release-preflight,verify-release-apk}.py`; tests/workflow | None | full matrix, live eval, signed/public release authorization |

## Tracking observation

`HandTracker` publishes no sample when MediaPipe misses a hand; `GuidanceEngine.pinHand` consequently has no pad and correctly stays silent. `FrameRouter` separately requires `ScreenTracker.TRACKING` for rectified guidance frames. The current intermittent keypad observation is therefore reproducible as an input/physical tracking loss, but source review found no deterministic defect that warrants an unverified confidence, debounce, or geometry change. The required next engineering evidence is a retained, camera-free numeric log plus a controlled physical re-run, not a guessed code adjustment.
