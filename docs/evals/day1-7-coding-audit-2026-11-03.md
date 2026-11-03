# Day 1–7 coding audit — 2026-11-03

**Later continuation:** the user explicitly added both optional features. Mock-glasses replay and Android donation coding are now implemented and locally verified; their physical/cloud acceptance remains open. See [deferred-code cleanup](deferred-code-cleanup-2026-11-03.md). The measurements below are the earlier audit snapshot.


This audit compares the plans/specifications with the active implementations, not copied assets or unchecked claims of completion. It includes protocol/session admission, model and speech routing, task/payment/PIN boundaries, the native engine and entry points, memory, evaluation, configuration and release tooling. README's development-beta warning remains accurate. No device trial, paid model call, deployment, signing, account setup or release was performed in this continuation.

## Repairs implemented and verified

| Plan area | Finding and implemented behavior |
|---|---|
| D1-T7b / design §1, §5.1 | Added the missing Quick Settings tile and static launcher shortcut. The system permission protects tile binding; locked launches wait for unlock; the normal foreground activity retains onboarding, saved settings and camera/mic permission gates. API34+ uses an immutable explicit activity PendingIntent; API29–33 uses its guarded legacy counterpart. |
| D2-T10b/c / design §3.3 | Cloud speech errors in listening/reply/confirm/explore turns switch to the on-device-only recognizer without discarding the turn. Late cloud transcripts cannot enter local/private/PIN/basic speech modes. Missing local speech remains an explicit unavailable condition. |
| B4-1/B4-2 / protected speech | Private/sensitive sessions refuse Meta ASR and label keywords, close active relays, use local-only Android speech, and reject stale results. Local replies/goals reuse existing fp.v1 messages. A kiosk cache hit cannot prematurely clear sensitivity; a fresh classification is required. |
| B4-2 / payment safety | The central target boundary refuses pay/confirm/submit controls in guide-only mode, including cached targets. Task-mode confirmation assertions and flow fixtures remain intact. |
| A4-3 / PIN session boundary | PIN entry interrupts a stalled model call, cancels queued uploads and closes the speech relay. Goals, audio and keyframes remain suppressed until explicit PIN exit; abort alone cannot clear protection. Android stops local ASR as well as the cloud mic. |
| D3-T10 / C4-4 | Added private image-bundle preparation, anonymous numeric server output and debug instrumentation using production OCR + PIN gate. SHA-256, anonymous IDs and truth bind server/local measurements. Sim and real origins, local PIN truth and server-sensitive truth are separate. Null OCR and missing server results stay unknown; mock results cannot count as live evidence. |
| B6-2 / A5-3 version policy | The same cached minimum version now gates WebSocket hello and `/v1/config`. Old/malformed versions get `version_unsupported` before ready/model work. A rejected repeated hello cancels the old context. Refresh validates SemVer, preserves last-good policy, coalesces work and bounds caller waits. |

No dependency pins, wire schemas or safety thresholds were changed. The image-evaluation runner reuses existing debug instrumentation instead of adding a product debug screen or test framework. Its limits are evaluation-only and documented in the procedure.

## Day-by-day coding disposition

| Day | Required coding disposition | What remains beyond these local repairs |
|---|---|---|
| 1 | Workspace, protocol, model/gateway adapters, simulator, native camera/tone, profiling and regional measurement code exist. Launch options are now present. | T7c performance remains an unresolved engineering gate, needing controlled physical profiling before choosing another optimization. Regional/quality/photo/tablet/account gates remain open. |
| 2 | Guidance/state/cues, resolving, session/ASR/simulator relays, screen tracking, mic/keyframes, native engine and evaluator are implemented. Speech-failure fallback is repaired. | Actual recognition/guidance/alignment/press trials and regional deployment are unaccepted. Browser replay is not phone acceptance. |
| 3 | OCR/PIN/two-source/framing/onboarding, attestation/auth/quota/revocation and deploy source exist. The missing actual-image OCR measurement path is now compiled. | Human root review, Firebase/hardware/cloud/real-photo acceptance and physical image runs remain. |
| 4 | Settings/output guard, task/payment/PIN states, private planning/routing/speech and actual PIN playback-route enforcement are implemented with local regressions. | Glimmer deployment, actual earphone/disconnect behavior, physical accessibility/localization/safety and tester checks remain. |
| 5 | Explore, device cache, shared kiosk memory, breaker/fallback, load/update/Crashlytics source and public pages exist. **B5-2 has a newly verified name-retention conflict awaiting a decision.** | Hashing all control candidates until two-install agreement would change an existing first-install storage assertion; AGENTS §4 requires resolution before that rewrite. Tester-driven tuning awaits findings. A5-4 mock glasses and C5-4 donation upload remain optional, explicitly cut/deferred code. |
| 6 | Offline speech/text matching, low-vision UI, release/config/waitlist, telemetry/budget/monitoring/incident code and landing source exist. Minimum-version admission is repaired. | Signing, actual persistence/config/metrics/alerts/notification/deployment, phone accessibility and real footage require external setup/evidence. |
| 7 | Numeric evidence/matrix/revision checker and draft/public release workflow are implemented. Empty, stale or mock-only evidence cannot authorize publication. | The 72-cell bug bash, two-phone soaks, earlier live safety gates, reviewed known issues and human release execution remain unperformed. No beta-complete or tag claim. |

## Verified regression evidence

- New gateway privacy tests reproduced four failures; missing native speech-policy APIs failed before implementation.
- Four guide-payment cases failed first. Two PIN cancellation/upload cases failed first and a quota-race control passed; all three now pass.
- Minimum-version/cache cases failed before implementation; SemVer and actual app WebSocket/config-cache integration now pass.
- Three launch-resource checks failed for absent entry points. The native speech-fallback API failed compilation before implementation.
- Five pure image-accounting/validation tests failed for the missing API; seven export cases failed for the missing module. Added native CLI and amount-summary/unknown-result controls also pass.
- Latest TypeScript suites: **705 tests** (protocol59, web53, gateway527, evals66). Recursive typecheck and builds pass.
- Native: **381 JVM tests** (guidance290, protocol54, app37); debug APK, debug instrumentation APK and lint pass (**0 errors, 16 existing warnings**). Compiling instrumentation is not executing it on a phone.
- Python tooling: **78 tests** pass.

The first launch lint run rejected the legacy tile API despite its SDK guard. A narrowly scoped, explained lint annotation covers only API29–33's required compatibility call; modern devices use the replacement API. No safety tests or existing assertions were weakened, skipped or deleted.

## Blocking code decision

B5-2: a synthetic button named `Synthetic Personal Name` is stored after one install (`{"untrustedNameStored":true}`). Design §4.9 forbids dynamic names in shared memory. The existing `strips prices, names and numbers before storing` test expects first-install raw button labels `['Small', 'Medium', 'Large', 'Back', 'Table']`; the implementation hashes only `text` candidates. Safely extending the existing two-install agreement to controls conflicts with that assertion. The user has been asked to resolve this; the task is blocked and the existing tests remain intact.

Next coding action: resolve B5-2's storage rule, then add a failing-first named-control regression and implement the approved retention policy. Once a phone is available, perform controlled T7c profiling and the documented physical acceptance; GCP remains deferred. See [image procedure](pin-image-evaluation.md) and [progress](../progress.md).
