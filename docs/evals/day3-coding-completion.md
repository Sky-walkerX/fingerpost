# Day 3 coding completion checkpoint

The user requested completion of the coding through Day 3 after the audit. This continuation closes the three reproduced backend findings and the related quota race. It does not mark human, device, provider or GCP acceptance complete. All changes remain local; no push or deployment was performed.

## Implemented repairs

- **Spend accounting:** billed model/ASR output waits for accounting. Failed recording cancels the current turn, reports the existing content-free `cloud_paused` error, blocks subsequent billed work and attempts to persist `cloudEnabled: false`. The current gateway stays disabled after an accounting failure until spend is reconciled and it is restarted. In-flight stale enable reads cannot override accounting failure or reaching the daily cap.
- **Server authorization deadline:** the verified signed `exp` is retained separately from the unchanged claims-only API. Authenticated sockets close with 4401 at that deadline, including idle sockets. Message arrival, queued execution and outbound results check the deadline; expiry disposes the controller and suppresses late model output. Existing Android 4401 handling and 12-minute renewal are retained; no wire schema changed.
- **v1 deployment consistency:** the deployment target is one instance, matching the planned in-memory challenge/per-client limiter stores. The old three-instance configuration was inconsistent. Multi-instance scaling requires shared atomic stores before raising the limit. Instance replacement can invalidate an outstanding challenge; real routing/restart behavior still needs acceptance. No multi-instance authentication support is claimed.

Test first: four accounting regressions and the strengthened old ledger-continuation case fail initially; two further in-flight flag-read races fail before repair. Three socket-expiry regressions fail before implementation. A new deployment assertion fails with the previous three-instance value, then passes after correction. No test was skipped/deleted or weakened. Three old usage-fixture callbacks now return void explicitly to support awaited callbacks; their assertions are unchanged.

## Validation

| Check | Actual result |
|---|---|
| `pnpm -r test` | **470 pass:** protocol 57, web 28, gateway 336, evals 49 |
| `pnpm -r typecheck` | Pass |
| `pnpm -r build` | Pass |
| `pnpm check:day2` | Both local synthetic protocol scenarios pass; no external calls |
| Python tooling discovery | **36 pass**, including eight deployment-orchestration tests |
| `bash -n infra/deploy-gateway.sh` | Pass |
| Local Firestore demo emulator | **Seven groups pass**, including real SDK flag persistence after an injected accounting failure; zero cloud calls |

The Android source/APK is unchanged in this continuation. The prior verified checkpoint remains **228 JVM cases and 18 camera-free physical-phone diagnostics**, not fresh camera/TalkBack/Firebase acceptance. The earlier 170-image synthetic corpus/renderer verification remains valid; it was not relabeled as real data. Remote CI was not run for these unpublished commits. No dependencies or pinned versions changed.

## Coding scope through Day 3

| Task | Coding status | Remaining completion requirement |
|---|---|---|
| T0 | Trial procedure/recording sheet present; no application code required | Twenty human physical trials and measured gate decision |
| T1 | OCR, face covering, keyframe tokens, optional private Firebase CI setup implemented | Actual OCR/face-cover device inspection and real configuration |
| T2 | PIN guard, mic stop, exit/reacquire and two-source checks implemented | Physical keypad transitions proving no uploads and correct recovery |
| T3 | Press evidence, framing and guidance wiring implemented | Actual touchscreen guide/press/verify and framing cues |
| T4 | Reacquire, glare, metering and persisted spoken onboarding implemented | Tutorial gestures/persistence, focus/exposure and ten-minute TalkBack session |
| T5 | Cryptographic verifier and public root bundle present/tested | Independent human root-fingerprint review |
| T6 | Auth routes, single-use challenges and JWT checks implemented; deadline enforced | Human review plus actual authenticated setup/acceptance |
| T7 | Quotas, persistence, rules and fail-closed accounting implemented/tested locally | Production database/rules/runtime setup and full acceptance |
| T8 | Android Firebase/Keystore client and renewal implemented | Actual Firebase, hardware tier and on-phone renewal |
| T9 | Auth-on deploy script implemented/tested for v1 single-instance scope | Human account/secrets/IAM, deployment and guided cloud task |
| T10 | Renderer, evaluator and landing preview implemented/tested | Permissioned real photos, live recall measurement and tester bookings |

The full Day 3 board stays blocked where these requirements remain unmet. Inherited tracking performance, current live-recognition timeout, real-photo quality, region selection and Day 2 physical guidance remain open. Next work is acceptance with the user/testers and configured services; do not infer a release gate pass or start Day 4 from this coding checkpoint alone.
