# Progress board

Agents and people both update this file. Keep each line short. Status values are `todo`, `doing`, `blocked` and `done`. Claim a task by setting `doing` and your name, and commit that change on its own (see AGENTS.md §3).

**Current day:** Day 1, Tue Oct 27 · **Plans ready:** Days 1–3 · **Days 4–7:** written each evening from that day's results (design.md §7 has the outline)

## Day 1: `docs/superpowers/plans/2026-10-27-day1-foundations.md`
| Task | What | Lane | Depends on | Status | Owner |
|---|---|---|---|---|---|
| D1-T0 | Accounts, Android Studio, photos, tester outreach (human) | all | – | todo | |
| D1-T1 | Monorepo root | – | – | todo | |
| D1-T2 | packages/protocol | B | T1 | todo | |
| D1-T3 | Gateway: config, hub, app, container | B | T2 | todo | |
| D1-T4 | Spark parse + SAM adapters | B | T3 | todo | |
| D1-T5 | Live smoke, deploy, region (ADR-0003) | B | T0, T4 | todo | |
| D1-T6 | Kiosk simulator v0 | C | T1 | todo | |
| D1-T7a | Gradle + core:guidance cue math | A | T0 (JDK) | todo | |
| D1-T7b | App shell (Compose, TalkBack, permission) | A | T7a | todo | |
| D1-T7c | CameraX + MediaPipe fingertip overlay | A | T7b | todo | |
| D1-T7d | Tone prototype | A | T7c | todo | |
| D1-T8 | CI green + tester docs | C | T1, T7b | todo | |

## Day 2: `docs/superpowers/plans/2026-10-28-day2-closed-loop.md`
| Task | What | Lane | Depends on | Status | Owner |
|---|---|---|---|---|---|
| D2-T1 | core:protocol (Kotlin) | A | D1-T2, D1-T7a | todo | |
| D2-T2 | Target zones, fingertip | A | D1-T7a | todo | |
| D2-T3 | Phrases, speech queue | A | D2-T2 | todo | |
| D2-T4 | Guidance state machine | A | D2-T3 | todo | |
| D2-T5 | Goal → element resolution | B | D1-T4 | todo | |
| D2-T6 | Session pipeline | B | D2-T5 | todo | |
| D2-T7 | Controller, ASR relay, sim relay | B | D2-T6 | todo | |
| D2-T8 | Eval harness + labels + baseline | C | D2-T7 | todo | |
| D2-T9 | Sim scenes 2/4 + touch relay | C | D1-T6 | todo | |
| D2-T10a | Screen tracker + local quad (device) | A | D2-T2 | todo | |
| D2-T10b | Session client + mic + keyframes (device) | A | D2-T1, D2-T7 | todo | |
| D2-T10c | Guidance engine wiring (device) | A | D2-T4, D2-T10a, D2-T10b | todo | |
| D2-T10d | Proxy trials (exit check) | C | D2-T10c | todo | |
| D2-T11 | Labeling page, tester booking | C | D1-T6 | todo | |

## Day 3: `docs/superpowers/plans/2026-10-29-day3-gate-robustness.md`
| Task | What | Lane | Depends on | Status | Owner |
|---|---|---|---|---|---|
| D3-T0 | Noon tech gate | C | D2-T10c | todo | |
| D3-T1 | OCR, face covering, OCR tokens (device) | A | D2-T10b | todo | |
| D3-T2 | PIN gate + two-source agreement | A | D3-T1 | todo | |
| D3-T3 | Screen-change evidence + framing coach | A | D2-T10c | todo | |
| D3-T4 | Reacquire, glare, TalkBack, onboarding | A | D3-T3 | todo | |
| D3-T5 | Key Attestation verifier | B | D2-T7 | todo | |
| D3-T6 | Challenges, JWT, auth routes | B | D3-T5 | todo | |
| D3-T7 | Quotas, kill switch, auth on the socket | B | D3-T6 | todo | |
| D3-T8 | Attestation client + Firebase auth (device) | A | D3-T6 | todo | |
| D3-T9 | Deploy with auth on | B | D3-T7, D3-T8 | todo | |
| D3-T10 | PIN/payment dataset, landing v0, bookings | C | D2-T8 | todo | |

## Open security follow-ups (from the automated review of 8af4b1c)
- Fixed in Day 3 assets: live config fails closed (AUTH_REQUIRED=false needs ALLOW_UNAUTHENTICATED_LIVE=true); software attestation off by default in live; challenge/attest rate-limited per IP; sim route disabled in live without SIM_TOKEN, timing-safe compare; kill switch also applies to unauthenticated sessions.
- Also fixed in Day 2 assets: the sim route fails closed in live mode and compares the token in constant time. Nothing is open.

## Blockers
_(task id · exact command · last lines of output · what you tried)_

## Deviations from the plan
_(task id · what changed · why · who approved)_

## Measurements
| Date | What | Value | Where |
|---|---|---|---|

## Log
- 2026-10-27: design, specs, ADRs and the Days 1–3 plans are committed. Planning verified the assets: each day's starting state typechecks, and the reference passes gateway 105 tests, protocol 46, web 20, evals 5, Kotlin guidance 81, Kotlin protocol 41.
