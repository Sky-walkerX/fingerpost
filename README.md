# Fingerpost

Fingerpost is being built to guide a blind or low-vision person's finger to the right spot on a touchscreen: appliance panels, kiosks, ticket machines and card terminals. The Android app uses speech, tones and vibration and checks that a press worked. PIN entry must stay entirely on the phone. Closed-loop integration is implemented but still needs device acceptance; multi-step agent work remains planned.

We're building it for the Meta Global AI Developer Hackathon (Indie track), using Muse Spark, SAM 3.1, Voice Transcribe and Muse Glimmer. The build runs Oct 27 to Nov 2, 2026, and the submission is due Nov 5 at 07:30 IST.

> **Status (2026-10-31): available development through Day 3 is implemented and locally verified; Day 2/3 acceptance remains incomplete.** Added spoken persisted onboarding, camera metering, authenticated-socket renewal, stricter JWT validation, fail-closed spending flags, local Firestore checks and safe dataset rendering. All 461 TS/228 Android JVM/35 tooling cases pass; 18 actual camera-free phone diagnostics pass. Real guidance/TalkBack trials, recognition quality and human security review remain open; GCP checks are deferred. See [Day 3 evidence](docs/evals/through-day3-2026-10-31.md), [cloud checklist](docs/evals/cloud-revalidation.md) and [`docs/progress.md`](docs/progress.md).

The [Day 1 completion audit](docs/evals/day1-completion-audit.md) confirms **8/12 original tasks complete and 1/5 exit checks passed**. T0 setup, T5 live validation/region, T6 tablet acceptance and T7c performance/regression remain open. The additional Kotlin protocol foundation is complete; it does not complete the Day 2 phase.

## Resume here
1. **Read the workflow and current state.** Start with [`AGENTS.md`](AGENTS.md), then [`docs/progress.md`](docs/progress.md) and the current implementation plan. [`docs/design.md`](docs/design.md) §1 has the locked decisions, §4 the architecture, and §7 the 7-day outline and exit criteria.
2. **Pick your lane:**
   - **A:** the Android app and guidance. Read [`docs/guidance-spec.md`](docs/guidance-spec.md).
   - **B:** the gateway and AI pipeline. Read [`docs/protocol.md`](docs/protocol.md).
   - **C:** evals, testers, the web page and the video.
3. **Run the current plan:** the user requested remaining [Day 2](docs/superpowers/plans/2026-10-28-day2-closed-loop.md) development and then [Day 3](docs/superpowers/plans/2026-10-29-day3-gate-robustness.md). Available implementation/local checks are recorded; next are actual onboarding/TalkBack and touchscreen trials, current live recognition failure and real-data gates. GCP-only checks stay deferred. Day 4 development is paused. Follow individual completion gates; code or synthetic tests alone do not complete a device task.
4. **Check the reasoning:** the "why" behind the big decisions is in [`docs/adr/`](docs/adr).

## Where things stand
| Item | State |
|---|---|
| Design, guidance spec, protocol, ADRs 0001, 0002, 0004, 0005 | Written; listed ADRs accepted. This records decisions, not completed product behavior. |
| ADR 0003 (Cloud Run region) | Pending: decided by Day 1's latency measurements |
| Implementation plans | Days 1–3 and Days 4–7 parallel lanes written; follow dependency and completion gates |
| D1-T1: workspace root | Complete; pinned tooling, lockfile, CI workflow and community documents present |
| D1-T2: TypeScript protocol | Complete; current suite has 57 passing cases, including invalid fixtures and four new shared flow contracts. Typecheck/build pass; schema export previously verified. Kotlin counterpart is implemented as the CI prerequisite below. |
| D1-T3: gateway foundations | Complete; 14 targeted tests, typecheck, builds and actual container health/non-root checks pass under rootless Podman. |
| D1-T4: Spark/SAM adapters | Implemented and tested; live parsing and box segmentation pass on synthetic input. D1-T5 real-photo smoke/quality acceptance remains open. |
| D1-T5: live evaluation/deployment | Partial: ten-photo low-reasoning diagnostic completes, but visual correctness is **6/10** (required ≥8/10); Spark p50/p95 9.7/14.9 s. Candidate rejected; reasoning remains omitted. The later B4-0 five-second/zero-retry policy needs live revalidation. Failed-call evidence retention is fixed/tested. Production smoke acceptance, GCP deployments, regional measurements and ADR acceptance remain pending. See [scores/metrics](docs/evals/day1-smoke.md). |
| D1-T6: simulator | Implemented; expanded web suite has 28 passing cases and production build passes. Desktop checks are recorded; Android tablet acceptance remains pending. |
| D1-T7a: Android foundation | Complete; Gradle project and cue math implemented; the original 12 cue/filter tests pass within the current 166-test guidance suite. |
| D1-T7b: Android shell | Complete; debug APK builds, installs and launches. User-confirmed spoken denial, settings return, black session screen and single TalkBack element; permission state corroborated through ADB. Camera tracking and tone acceptance are recorded separately in T7c/T7d. |
| D1-T7c: camera/fingertip | Implemented; transforms and callback-image cleanup tested within the 166-case guidance suite; 24 tracking-tool tests pass. Acceptance tooling rejects CPU mode and incomplete awake/window evidence. Retained GPU/two-hand measurements fail: 5–8 fps / 107–167 ms under severe throttling, against ≥25 fps / ≤25 ms. Integrated-build visual/TalkBack regression remains pending; a connected-phone functional run returned to severe throttling; current 4–10 FPS samples are not an unthrottled benchmark. See [`profiling report`](docs/evals/day1-tracking-profile.md). |
| D1-T7d: tone prototype | Complete within prototype scope after the user explicitly deferred unfinished T7c. Twelve tone tests pass; user confirmed pitch/pan, click-free TalkBack toggling, no-hand/background silence and prompt perceived response. See [`tone report`](docs/evals/day1-tone.md). |
| D2-T1: Kotlin protocol foundation | Complete; pulled forward to resolve Day 1 CI's missing-module dependency. Current shared-fixture suites have 53 passing JVM cases and 57 TS cases. Network client device acceptance is tracked separately. |
| D2-T2: target geometry and fingertip | Complete; iso-space zones/error, debouncing/reset, pad compensation, valid/nearest hand selection and off-screen bounds. Twenty supplied tests and six added boundaries pass; pure JVM logic, not app wiring. |
| D2-T3: cue planning and speech | Complete; supplied cue planner retained, English phrases and priority/cadence/freshness speech queue implemented. Sixteen supplied tests and six added boundaries pass. Android TTS wiring remains T10c. |
| D2-T4: guidance state machine | Complete in pure JVM scope; retries, target hysteresis and verification implemented. DONE waits for its correlated speech completion; user authorized correcting the conflicting plan/test. Android wiring remains T10c. |
| D2-T5: target resolution | Complete; exact/fuzzy alias matching, ambiguity handling, position words and label lists. Seven supplied plus ten boundary tests pass. |
| D2-T6: session pipeline | Complete as a standalone component: locate/clarify/SAM target, verify and quota/usage hooks; 20 tests pass. |
| D2-T7: session/ASR/sim wiring | Local wiring repaired: browser CORS, endpointing, full-frame SAM anchor and screen-space projection pass. Two native loopback scenarios pass. Historical live exchange passed; current full-frame probe does not produce a Spark result/target, so live acceptance needs revalidation. GCP deployment remains deferred; T7 is not done. See [current evidence](docs/evals/day2-local-completion-2026-10-31.md). |
| D2-T8: eval harness, labels and baseline | Local tooling verified: 49 eval tests; safe CLI/path preflight, anonymous reports and expected 50% synthetic mock baseline. Real ground-truth labels/live baseline and T7 deployment dependency remain blocked. See [continuation report](docs/evals/day2-evaluator.md). |
| D2-T9: simulator scenes and relay | Incoming scenes implemented, supplied tests pass; three actual desktop browser taps reach the linked gateway. Required tablet acceptance remains open. |
| D2-T10a–c: Android integration | Implemented and repaired; 166 guidance/53 protocol/nine app cases, debug build and lint pass. Later locate uploads use screen crops; camera pitch survives phone rotation. Actual phone testing exposed and repaired a PIN-regex crash; eight physical safety checks pass. Camera/OCR run, but microphone/full-loop acceptance and thermal performance remain open. See [device evidence](docs/evals/day2-device-2026-10-31.md). |
| D2-T10d: proxy trials | No completed trials recorded; required 10-trial physical check remains open. |
| D2-T11: labeling and bookings | Local annotation/export/error handling verified in the browser and against the evaluator schema; eight contract checks pass. EN/HI consent describes connected processing. Human bookings remain pending. |
| D3-T1–T4: Android robustness | OCR, face covering, PIN upload guard, two-source checks, press/framing/reacquire/glare integration present; persisted spoken tutorial and stable-quad AF/AE added. JVM/build/lint pass. Real OCR/face/PIN, ten-minute TalkBack, onboarding gestures and focus acceptance remain open. |
| D3-T5–T8: auth and quotas | Verifier/auth routes retained; JWT bounds and active socket renewal repaired. Real local Firestore emulator passes transactions, quota/reset, spend kill switch and client rules. Human root review, actual Firebase/hardware acceptance and production setup remain open. |
| D3-T0/T9: gate and deployment | [Tech gate NOT RUN](docs/evals/gate-day3.md). Auth-on deployment script passes seven stub tests; cloud and proxy acceptance deferred, no account/deployment created. |
| D3-T10: PIN/payment corpus and landing | Tracked 170 synthetic images preserved; another 170-image corpus renders/decodes privately. Landing is an honest disabled waitlist preview. Twenty real photos, live recall and bookings remain pending. |
| B4-0: contracts and gateway hardening | Complete in documented local scope: four synthetic flow scripts, abort bypass/stale-result guards and five-second model/ASR connection limits. All 17 added gateway cases pass. Agent runtime replay, device flows, router/fallback and live policy acceptance remain separate tasks. See [evidence](docs/evals/day4-gateway-hardening.md). |
| Incoming Android/auth/eval work | Screen tracking, session/mic/keyframes, guidance engine, PIN checks, auth/quota, eval harness and extra simulator scenes are in source. Local checks pass; required device/cloud acceptance is separate. See [sync inventory](docs/evals/repository-sync-2026-10-30.md) and [device handoff](docs/evals/android-integration-handoff.md). |
| D1-T8: CI and tester preparation | Complete; weekly Dependabot config, 45-minute session protocol, English/Hindi consent/outreach drafts and organization-only tracker checked. Both CI jobs pass at audit revision 2480252, including the new Python tooling checks. No invitations sent or testers booked. |
| Laptop toolchain | JDK 21 and pinned pnpm installed; Android Studio project paths configured. SDK Platforms 36/37 and Build Tools 36.0.0 available. Use `scripts/android.sh`; see `docs/local-development.md`. |
| CI | Both jobs green at [Day 3 implementation 6056420](https://github.com/Sky-walkerX/fingerpost/actions/runs/41218618087). Frozen install, typechecks, all TS/tooling/Kotlin/app tests and Android debug build pass. |
| Accounts: Meta API key + credits, Modal credits, GCP projects, Firebase | Meta access verified; credit balance and remaining human/cloud setup are unverified or incomplete (D1-T0) |
| Testers | Outreach has no recorded completion; human-only task |

Most recently verified locally: **461 TypeScript tests, 228 Android JVM cases and 35 tooling tests pass**, with recursive typechecks/builds, debug/test APK assembly and lint clean of errors (seven advisories). The actual connected phone passes 18 camera-free diagnostics. Local Firestore persistence and 170 fresh synthetic images are verified; `pnpm check:day2` completes both protocol scenarios with no external calls. Real model quality, device guidance/performance, human root review, actual Firebase/hardware authentication and regional deployment remain open. See [Day 3 evidence](docs/evals/through-day3-2026-10-31.md).

The development APK is generated locally at `apps/android/app/build/outputs/apk/debug/app-debug.apk`. Camera tracking has not met its performance gate. The tone prototype passed its earlier device checks; the integrated guidance build still needs human/device acceptance.

## Planned layout
```
apps/android/            Kotlin app (phone = real-time "body": camera, finger tracking, guidance, PIN safety)
apps/web/                landing page + kiosk simulator for the Android tablet
services/gateway/        TypeScript on Cloud Run ("brain": agent, prompts, model routing, quotas)
services/private-models/ Glimmer on Modal (private mode)
packages/protocol/       fp.v1 message schemas + golden fixtures shared by TS and Kotlin
evals/                   datasets and eval runners
infra/                   gcloud / firebase scripts
docs/                    design, specs, ADRs, plans, eval reports
```

## Ground rules
- **Secrets:** never commit them. `META_API_KEY` goes in `.env` (gitignored) locally and in Secret Manager on Cloud Run. API keys are never shipped inside the APK.
- **No frames or audio in logs, and no storage of them:** zero retention by default (ADR 0005).
- **Any change to a guidance number** updates `docs/guidance-spec.md` in the same PR.
- **Protocol changes** update `packages/protocol` and its fixtures, and the TS and Kotlin tests must both pass.
- **The hackathon requires a public repo** by submission (Nov 4). This repo is private for now.

## License
[Apache-2.0](LICENSE)
