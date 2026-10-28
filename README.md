# Fingerpost

Fingerpost is being built to guide a blind or low-vision person's finger to the right spot on a touchscreen: appliance panels, kiosks, ticket machines and card terminals. The planned Android app uses speech, tones and vibration, checks that a press worked, and walks through multi-step tasks. PIN entry must stay entirely on the phone. These end-to-end features are not implemented yet.

We're building it for the Meta Global AI Developer Hackathon (Indie track), using Muse Spark, SAM 3.1, Voice Transcribe and Muse Glimmer. The build runs Oct 27 to Nov 2, 2026, and the submission is due Nov 5 at 07:30 IST.

> **Status (2026-10-28): Day 1 foundations in progress.** Workspace, TypeScript protocol, gateway foundations/adapters and Android guidance math are implemented. The Android camera/fingertip build is installed, but its device performance gate fails. Simulator tablet acceptance and live model validation remain pending. See [`docs/progress.md`](docs/progress.md) for verified completion and blockers.

## Resume here
1. **Read the workflow and current state.** Start with [`AGENTS.md`](AGENTS.md), then [`docs/progress.md`](docs/progress.md) and the current implementation plan. [`docs/design.md`](docs/design.md) §1 has the locked decisions, §4 the architecture, and §7 the 7-day outline and exit criteria.
2. **Pick your lane:**
   - **A:** the Android app and guidance. Read [`docs/guidance-spec.md`](docs/guidance-spec.md).
   - **B:** the gateway and AI pipeline. Read [`docs/protocol.md`](docs/protocol.md).
   - **C:** evals, testers, the web page and the video.
3. **Run today's plan:** [`docs/superpowers/plans/2026-10-27-day1-foundations.md`](docs/superpowers/plans/2026-10-27-day1-foundations.md). Task 0 is the human setup (accounts, Android Studio). Tasks 1–8 are test-first engineering tasks with exact files, interfaces and commands.
4. **Check the reasoning:** the "why" behind the big decisions is in [`docs/adr/`](docs/adr).

## Where things stand
| Item | State |
|---|---|
| Design, guidance spec, protocol, ADRs 0001, 0002, 0004, 0005 | Written; listed ADRs accepted. This records decisions, not completed product behavior. |
| ADR 0003 (Cloud Run region) | Pending: decided by Day 1's latency measurements |
| Implementation plans | Days 1–3 written; executing the task checklists sequentially |
| D1-T1: workspace root | Complete; pinned tooling, lockfile, CI workflow and community documents present |
| D1-T2: TypeScript protocol | Complete; 46 tests, typecheck, build and JSON Schema export pass. Kotlin counterpart is D2-T1. |
| D1-T3: gateway foundations | Complete; 14 targeted tests, typecheck, builds and actual container health/non-root checks pass under rootless Podman. |
| D1-T4: Spark/SAM adapters | Implemented; all 43 gateway tests pass with synthetic fixtures/stubs. Live model smoke is D1-T5 and still needs human setup. |
| D1-T6: simulator | Implemented; 14 tests and production build pass; desktop fast-food flow and scrambled PIN scene checked. Android tablet acceptance pending. |
| D1-T7a: Android foundation | Complete; Gradle project and cue math implemented; all 12 JVM guidance tests pass. |
| D1-T7b: Android shell | Complete; debug APK builds, installs and launches. User-confirmed spoken denial, settings return, black session screen and single TalkBack element; permission state corroborated through ADB. Camera tracking and tone output come in T7c/T7d. |
| D1-T7c: camera/fingertip | Implemented and installed; fused transforms and callback-image cleanup added. All 25 guidance tests, 18 diagnostic-tool tests, build and lint pass. Earlier visual following passed; fused-build visual/TalkBack regression pending. Comparison phone GPU/two-hand run still fails: 10–12 fps / 43–86 ms against ≥25 fps / ≤25 ms. See [`profiling report`](docs/evals/day1-tracking-profile.md). |
| Laptop toolchain | JDK 21 and pinned pnpm installed; Android Studio project paths configured. SDK Platforms 36/37 and Build Tools 36.0.0 available. Use `scripts/android.sh`; see `docs/local-development.md`. |
| CI | All 103 TypeScript tests pass locally. Android workflow still references `core:protocol`, scheduled for D2-T1; full CI remains pending. No checks disabled. |
| Accounts: Meta API key + credits, Modal credits, GCP projects, Firebase | Human setup remains unverified/incomplete on the progress board (D1-T0) |
| Testers | Outreach has no recorded completion; human-only task |

Current verified totals: 103 TypeScript tests, 25 Kotlin guidance tests and 18 synthetic diagnostic-tool tests pass; the app debug build and lint pass. The larger test counts in the original planning log describe reference assets. Days 2–3 assets, including authentication and PIN protection, are not runtime features yet.

The development APK is generated locally at `apps/android/app/build/outputs/apk/debug/app-debug.apk`. Camera tracking is implemented but has not met its acceptance gate. Tone playback and end-to-end guidance are not implemented yet.

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
