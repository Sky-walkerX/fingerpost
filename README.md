# Fingerpost

Fingerpost is being built to guide a blind or low-vision person's finger to the right spot on a touchscreen: appliance panels, kiosks, ticket machines and card terminals. The Android app uses speech, tones and vibration and checks that a press worked. PIN entry must stay entirely on the phone. Closed-loop integration is implemented but still needs device acceptance; multi-step agent work remains planned.

We're building it for the Meta Global AI Developer Hackathon (Indie track), using Muse Spark, SAM 3.1, Voice Transcribe and Muse Glimmer. The build runs Oct 27 to Nov 2, 2026, and the submission is due Nov 5 at 07:30 IST.

> **Status (2026-10-30): testing through D2-T7; Day 1 remains incomplete.** Live Spark/SAM/Voice Transcribe pass an authenticated local gateway flow using synthetic media. Android integration builds and tests pass; device acceptance and tracking performance remain open. A ten-photo low-reasoning experiment scores 6/10 correct targets and is rejected. Regional Cloud Run deployment and tablet acceptance remain pending. See [current test evidence](docs/evals/through-day2-t7-2026-10-30.md) and [`docs/progress.md`](docs/progress.md).

The [Day 1 completion audit](docs/evals/day1-completion-audit.md) confirms **8/12 original tasks complete and 1/5 exit checks passed**. T0 setup, T5 live validation/region, T6 tablet acceptance and T7c performance/regression remain open. The additional Kotlin protocol foundation is complete; it does not complete the Day 2 phase.

## Resume here
1. **Read the workflow and current state.** Start with [`AGENTS.md`](AGENTS.md), then [`docs/progress.md`](docs/progress.md) and the current implementation plan. [`docs/design.md`](docs/design.md) §1 has the locked decisions, §4 the architecture, and §7 the 7-day outline and exit criteria.
2. **Pick your lane:**
   - **A:** the Android app and guidance. Read [`docs/guidance-spec.md`](docs/guidance-spec.md).
   - **B:** the gateway and AI pipeline. Read [`docs/protocol.md`](docs/protocol.md).
   - **C:** evals, testers, the web page and the video.
3. **Run today's plan:** [`docs/superpowers/plans/2026-10-27-day1-foundations.md`](docs/superpowers/plans/2026-10-27-day1-foundations.md). Task 0 is the human setup (accounts, Android Studio). Tasks 1–8 are test-first engineering tasks with exact files, interfaces and commands. The user has explicitly resumed the [Day 2 plan](docs/superpowers/plans/2026-10-28-day2-closed-loop.md) while retaining all unfinished Day 1 checks. Follow individual task prerequisites and completion gates.
4. **Check the reasoning:** the "why" behind the big decisions is in [`docs/adr/`](docs/adr).

## Where things stand
| Item | State |
|---|---|
| Design, guidance spec, protocol, ADRs 0001, 0002, 0004, 0005 | Written; listed ADRs accepted. This records decisions, not completed product behavior. |
| ADR 0003 (Cloud Run region) | Pending: decided by Day 1's latency measurements |
| Implementation plans | Days 1–3 and Days 4–7 parallel lanes written; follow dependency and completion gates |
| D1-T1: workspace root | Complete; pinned tooling, lockfile, CI workflow and community documents present |
| D1-T2: TypeScript protocol | Complete; 48 tests and typecheck pass, including new invalid-fixture coverage. Build/schema export previously verified. Kotlin counterpart is now implemented as the CI prerequisite below. |
| D1-T3: gateway foundations | Complete; 14 targeted tests, typecheck, builds and actual container health/non-root checks pass under rootless Podman. |
| D1-T4: Spark/SAM adapters | Implemented and tested; live parsing and box segmentation pass on synthetic input. D1-T5 real-photo smoke/quality acceptance remains open. |
| D1-T5: live evaluation/deployment | Partial: ten-photo low-reasoning diagnostic completes, but visual correctness is **6/10** (required ≥8/10); Spark p50/p95 9.7/14.9 s. Candidate rejected; production settings unchanged. Failed-call evidence retention is fixed/tested. Production smoke acceptance, GCP deployments, regional measurements and ADR acceptance remain pending. See [scores/metrics](docs/evals/day1-smoke.md). |
| D1-T6: simulator | Implemented; expanded web suite has 20 passing cases and production build passes. Desktop checks are recorded; Android tablet acceptance remains pending. |
| D1-T7a: Android foundation | Complete; Gradle project and cue math implemented; the original 12 cue/filter tests pass within the current 148-test guidance suite. |
| D1-T7b: Android shell | Complete; debug APK builds, installs and launches. User-confirmed spoken denial, settings return, black session screen and single TalkBack element; permission state corroborated through ADB. Camera tracking and tone acceptance are recorded separately in T7c/T7d. |
| D1-T7c: camera/fingertip | Implemented; transforms and callback-image cleanup tested within the 148-case guidance suite; 24 tracking-tool tests pass. Acceptance tooling rejects CPU mode and incomplete awake/window evidence. Retained GPU/two-hand measurements fail: 5–8 fps / 107–167 ms under severe throttling, against ≥25 fps / ≤25 ms. Fused-build visual/TalkBack regression remains pending; no device is detected in the latest pass. See [`profiling report`](docs/evals/day1-tracking-profile.md). |
| D1-T7d: tone prototype | Complete within prototype scope after the user explicitly deferred unfinished T7c. Twelve tone tests pass; user confirmed pitch/pan, click-free TalkBack toggling, no-hand/background silence and prompt perceived response. See [`tone report`](docs/evals/day1-tone.md). |
| D2-T1: Kotlin protocol foundation | Complete; pulled forward to resolve Day 1 CI's missing-module dependency. All 49 JVM protocol tests and the 48 TS protocol tests pass on shared fixtures. Network client device acceptance is tracked separately. |
| D2-T2: target geometry and fingertip | Complete; iso-space zones/error, debouncing/reset, pad compensation, valid/nearest hand selection and off-screen bounds. Twenty supplied tests and six added boundaries pass; pure JVM logic, not app wiring. |
| D2-T3: cue planning and speech | Complete; supplied cue planner retained, English phrases and priority/cadence/freshness speech queue implemented. Sixteen supplied tests and six added boundaries pass. Android TTS wiring remains T10c. |
| D2-T4: guidance state machine | Complete in pure JVM scope; retries, target hysteresis and verification implemented. DONE waits for its correlated speech completion; user authorized correcting the conflicting plan/test. Android wiring remains T10c. |
| D2-T5: target resolution | Complete; exact/fuzzy alias matching, ambiguity handling, position words and label lists. Seven supplied plus ten boundary tests pass. |
| D2-T6: session pipeline | Complete as a standalone component: locate/clarify/SAM target, verify and quota/usage hooks; 20 tests pass. |
| D2-T7: session/ASR/sim wiring | Local tests and live Step 4 pass: authenticated gateway, actual Spark/SAM/Voice Transcribe, synthetic speech/image, protected simulator press and verification. Step 5 regional redeployment remains blocked; T7 is not done. See [current test evidence](docs/evals/through-day2-t7-2026-10-30.md). |
| D2-T8: eval harness, labels and baseline | Local tooling verified: 36 eval tests; safe CLI/path preflight, anonymous reports and expected 50% synthetic mock baseline. Real ground-truth labels/live baseline and T7 deployment dependency remain blocked. See [continuation report](docs/evals/day2-evaluator.md). |
| Incoming Android/auth/eval work | Screen tracking, session/mic/keyframes, guidance engine, PIN checks, auth/quota, eval harness and extra simulator scenes are in source. Local checks pass; required device/cloud acceptance is separate. See [sync inventory](docs/evals/repository-sync-2026-10-30.md) and [device handoff](docs/evals/android-integration-handoff.md). |
| D1-T8: CI and tester preparation | Complete; weekly Dependabot config, 45-minute session protocol, English/Hindi consent/outreach drafts and organization-only tracker checked. Both CI jobs pass at audit revision 2480252, including the new Python tooling checks. No invitations sent or testers booked. |
| Laptop toolchain | JDK 21 and pinned pnpm installed; Android Studio project paths configured. SDK Platforms 36/37 and Build Tools 36.0.0 available. Use `scripts/android.sh`; see `docs/local-development.md`. |
| CI | Both jobs green at [D2-T7/T8 continuation 43d787c](https://github.com/Sky-walkerX/fingerpost/actions/runs/41064801915). Frozen install, typechecks, all TS/tooling/Kotlin/app tests and Android debug build pass. |
| Accounts: Meta API key + credits, Modal credits, GCP projects, Firebase | Meta access verified; credit balance and remaining human/cloud setup are unverified or incomplete (D1-T0) |
| Testers | Outreach has no recorded completion; human-only task |

Most recently verified locally: **363 TypeScript tests and 31 tooling tests pass**, with recursive typechecks/builds clean. The earlier integration verification passed 148 Kotlin guidance tests, 49 Kotlin protocol tests, five app tests and Android debug build/lint (six existing warnings); those Android checks were not repeated locally for the evaluator change. CI reran and passed Android tests/debug assembly at 43d787c. Live gateway integration passes using synthetic media and memory stores; Firebase/attestation/Firestore, real-panel quality, device performance and regional deployment acceptance remain open. See [continuation evidence](docs/evals/day2-evaluator.md).

The development APK is generated locally at `apps/android/app/build/outputs/apk/debug/app-debug.apk`. Camera tracking has not met its performance gate. The tone prototype passed its earlier device checks; the integrated guidance build still needs teammate acceptance.

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
