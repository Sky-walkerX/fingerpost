# Fingerpost

Fingerpost guides a blind or low-vision person's finger to the right spot on any touchscreen: appliance panels, kiosks, ticket machines and card terminals. You point an Android phone at the screen and say what you want. It guides you with speech, tones and vibration, checks that the press worked, and walks you through multi-step tasks. During PIN entry, nothing leaves the phone.

We're building it for the Meta Global AI Developer Hackathon (Indie track), using Muse Spark, SAM 3.1, Voice Transcribe and Muse Glimmer. The build runs Oct 27 to Nov 2, 2026, and the submission is due Nov 5 at 07:30 IST.

> **Status: planning done, code not started.** The repo holds the approved design and the Day 1 task plan. If you're picking this up, start at "Resume here" below.

## Resume here
1. **Read the design.** Start with [`docs/design.md`](docs/design.md). §1 has the locked decisions (don't re-open them), §4 the architecture, and §7 the 7-day plan with each lane's tasks and the exit criteria for every day.
2. **Pick your lane:**
   - **A:** the Android app and guidance. Read [`docs/guidance-spec.md`](docs/guidance-spec.md).
   - **B:** the gateway and AI pipeline. Read [`docs/protocol.md`](docs/protocol.md).
   - **C:** evals, testers, the web page and the video.
3. **Run today's plan:** [`docs/superpowers/plans/2026-10-27-day1-foundations.md`](docs/superpowers/plans/2026-10-27-day1-foundations.md). Task 0 is the human setup (accounts, Android Studio). Tasks 1–8 are test-first engineering tasks with exact files, interfaces and commands.
4. **Check the reasoning:** the "why" behind the big decisions is in [`docs/adr/`](docs/adr).

## Where things stand
| Item | State |
|---|---|
| Design, guidance spec, protocol, ADRs 0001, 0002, 0004, 0005 | Done |
| ADR 0003 (Cloud Run region) | Pending: decided by Day 1's latency measurements |
| Day 1 task plan | Done; how to run it (native or subagent-driven) not yet chosen |
| Code | Not started |
| Accounts: Meta API key + credits, Modal credits, GCP projects, Firebase | Not done (Task 0) |
| Lead's Mac | No JDK or Android SDK yet. Install Android Studio before any Android work. |
| Testers | Outreach starts Day 1 |

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
