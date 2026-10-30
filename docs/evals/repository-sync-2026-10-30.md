# Repository sync and change tracking — 2026-10-30

Requested by the user: pull the latest changes and retain a record of what changed. This is a sync inventory, not a full implementation audit or a claim that device/live requirements passed.

## Sync baseline

- Previous local implementation: `5cdd088` (environment template).
- First pull: 17 commits through `d623f6a`.
- Second pull: eight commits through `f6daf08`.
- Subsequent pulls: already up to date at `f6daf08`; local `main` and `origin/main` have no divergence. Working tree was clean before recording this report.
- Total incoming changes: 25 commits, 274 files. Local ignored credentials were not overwritten or committed.

## Changes to retain when continuing

| Area | Incoming work | Representative revisions |
|---|---|---|
| Workflow/planning | Blocked tasks now block dependents only; claim ownership in the first real commit; Days 4–7 parallel plan and board added | `270aa67`, `1eec185`, `14a45c6` |
| Simulator/web | Ticket/cooktop scenes, touch relay, local labeling tool and accessible landing page | `07cadc8`, `1844b65`, `23957e2` |
| Evaluations | Metrics/CLI/mock report and 170 synthetic PIN/payment simulator images with labels | `653d62b`, `8d71252` |
| Gateway auth | Android attestation verification, challenge/session JWT routes, revocation checks and bounded rate limiters | `c34f8e5`, `978303c`, `e54c194`, `3b6d431`, `12e9916`, `d623f6a` |
| Gateway quota/deployment | Usage accounting, daily quotas, spend kill switch, authenticated sockets and auth-on deployment script | `9b966d0`, `8ee058c`, `2bad5b1` |
| Android guidance/safety | Two-source agreement, screen-change/framing logic, fail-closed PIN checks and lost-tracking reacquisition | `0c0c604`, `c3f7ae2`, `99e4ef4`, `c6a2215` |
| Android integration | Screen quad/KLT tracker, socket/mic/OCR/face-covered keyframes, Firebase/attestation client and lifecycle guidance engine | `d22c66a`, `2f8789c`, `ef7b127`, `f6daf08` |

The Android device acceptance checklist is in [the integration handoff](android-integration-handoff.md). The presence of these implementations does not complete their required device checks. Some older task-board/audit summaries remain historical and should not be used as proof that incoming code is absent or accepted.

## Initial live-test findings (superseded)

The following describes the first post-sync probe. The user subsequently corrected the private credential: model access, speech transcription and the live gateway flow now pass. See [current testing through D2-T7](through-day2-t7-2026-10-30.md). The earlier 401 is no longer an open blocker.

The private root environment now contains a configured `META_API_KEY`; its value is never printed. A request to the official `GET https://api.meta.ai/v1/models` endpoint returned **401 Unauthorized**. Local format checks found no surrounding/internal whitespace, extra quote characters or added Bearer prefix. The existing bounded live Voice Transcribe handshake probe also failed; **zero audio bytes** were sent. Its fixed error does not establish a separate provider error code. No successful model access, transcription or quality result is claimed.

Day 1 panel JPEG count is zero; the approved private latency crop is absent. Cloud CLI is not installed at the checked path or on PATH. Full live gateway configuration also requires the newer authentication settings. Real-photo smoke, live regional comparison/ADR acceptance and cloud deployment remain blocked. The user was asked to verify/replace the key privately and identify any existing approved photo directory.

Fresh TypeScript tests after the second pull pass: **327 total** (48 protocol, 20 web, 253 gateway, six evals). Recursive TypeScript typecheck passes after rerunning with pnpm store access; the initial sandbox-only attempt could not open its store database. TypeScript production builds pass. Android validation was restarted after an interrupted session: `./scripts/android.sh :core:guidance:test :core:protocol:test :app:test :app:assembleDebug --console=plain` succeeds. Current reports show 148 guidance, 49 protocol and five app tests with zero failures/errors/skips. Protocol outputs were up to date; guidance/app cases ran in this check. No phone test or lint rerun is claimed.
