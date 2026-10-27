# Progress board

Agents and people both update this file. Keep each line short. Status values are `todo`, `doing`, `blocked` and `done`. Claim a task by setting `doing` and your name, and commit that change on its own (see AGENTS.md §3).

**Current phase:** Day 1 foundations (planned Tue Oct 27; still in progress Oct 28) · **Plans ready:** Days 1–3 · **Days 4–7:** written each evening from results (design.md §7 has the outline)

## Day 1: `docs/superpowers/plans/2026-10-27-day1-foundations.md`
| Task | What | Lane | Depends on | Status | Owner |
|---|---|---|---|---|---|
| D1-T0 | Accounts, Android Studio, photos, tester outreach (human) | all | – | todo | |
| D1-T1 | Monorepo root | – | – | done | Codex |
| D1-T2 | packages/protocol | B | T1 | done | Codex |
| D1-T3 | Gateway: config, hub, app, container | B | T2 | done | Codex |
| D1-T4 | Spark parse + SAM adapters | B | T3 | doing | Codex |
| D1-T5 | Live smoke, deploy, region (ADR-0003) | B | T0, T4 | todo | |
| D1-T6 | Kiosk simulator v0 | C | T1 | blocked | Codex |
| D1-T7a | Gradle + core:guidance cue math | A | T0 (JDK) | done | Codex |
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
- Also fixed in Day 2 assets: the sim route fails closed in live mode and compares the token in constant time. These are asset fixes, not deployed protections; the associated runtime implementation and validation tasks remain pending.

## Blockers
_(task id · exact command · last lines of output · what you tried)_


- D1-T6 · `adb devices -l` (outside the sandbox) returns only `List of devices attached`, with no devices. Browser fast-food flow and scrambled PIN scene verified; required physical tablet fullscreen/three-finger export checks remain unverified. No device results are inferred from unit tests.

- D1-T8 / CI · `gh run view 40523977390 --log-failed` reports `An error occurred trying to start process '/usr/bin/bash' with working directory '/home/runner/work/fingerpost/fingerpost/apps/android'. No such file or directory`. Root CI is present, not green; Android modules have not been implemented. Workflow not weakened to hide this.

## Deviations from the plan
_(task id · what changed · why · who approved)_
- D1-T1 · The referenced superpowers workflow skills are not installed; Codex follows the complete repository task checklist directly under the user’s autonomous-development instruction. No dependency or product changes.
- D1-T1 · System Node 22/pnpm 11.25 were not used: checks use bundled Node 24.22.1 and isolated pnpm 11.10.0 in /tmp. Git commits use Codex <codex@fingerpost.invalid> because no author identity is configured; no global configuration changed.

- D1-T3 · Omitted literal `--` from targeted pnpm test commands: the documented command ran all 43 gateway tests, including D1-T4. Corrected `pnpm --filter @fingerpost/gateway test app session` selects the intended 14 tests.
- D1-T3 · Removed Docker COPY lines for unrelated web/evals manifests (evals does not yet exist); gateway dependency installation only needs the protocol and gateway workspaces. Container execution remains unverified.

- D1-T3 · User resolved the size-limit conflict on 2026-10-28: use `bad_message` for oversized text/keyframes and update the protocol prose to match existing tests. No message schema or Kotlin model changes are needed.

- D1-T3 · Replaced the skeleton constructor parameter property with an explicit field assignment after `pnpm --filter @fingerpost/gateway dev` failed with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` under Node 24 strip-only execution. Public interface unchanged.

- D1-T0 · User explicitly authorized laptop tooling setup on 2026-10-28. Installed checksum-verified Temurin JDK 21.0.13+9, official Android command-line tools and Platform 36; retained Build Tools 36.0.0 and existing SDK/Studio. Pinned pnpm 11.10.0 now persists under ~/.local/share/fingerpost/node-tools. Project launcher selects tools without changing Java for other apps.

- D1-T3 · Container verification used installed rootless Podman with the same Dockerfile instead of installing Docker. Its default database referenced the old /home/namanhere23 path; a separate ~/.local/share/fingerpost/containers store avoids changing existing containers. Build, mock health response and non-root UID 1000 verified.

## Measurements
| Date | What | Value | Where |
|---|---|---|---|

## Log
- 2026-10-27: design, specs, ADRs and the Days 1–3 plans are committed. Planning verified the assets: each day's starting state typechecks, and the reference passes gateway 105 tests, protocol 46, web 20, evals 5, Kotlin guidance 81, Kotlin protocol 41.
- 2026-10-27: D1-T1 complete: root assets and lockfile added; SECURITY, CONTRIBUTING and Contributor Covenant 2.1 added. Node 24.22.1 / pnpm 11.10.0: install, recursive test and typecheck exited 0 (no packages yet); git diff --check clean. CI workflow is staged; Android CI awaits its planned modules.
- 2026-10-28: D1-T2 complete: binary framing and message parsing implemented after 45 expected TODO failures; all 46 tests pass, recursive typecheck, protocol build and JSON Schema export pass. Schemas and fixtures are unchanged from the plan. New commits use namanhere23 <namanhere23code@gmail.com> per user instruction.
- 2026-10-28: D1-T3 partial: copied assets and implemented config validation; 3 config/health tests pass and recursive typecheck passes. Hub remains blocked on conflicting size-limit error codes; remaining gateway tests are expected TODO failures, not a passing gateway.
- 2026-10-28: D1-T3 session hub implemented after user clarification: 14 app/session tests, recursive typecheck and protocol/gateway builds pass. Dev server and isolated `deploy --legacy --prod` package both return the expected /healthz JSON. Task stays blocked solely on the required Docker build/run; D1-T4 adapters remain TODO.
- 2026-10-28: D1-T6 implementation complete after the expected 7 red/7 green baseline: all 14 tests pass; web production build and recursive typecheck pass. Desktop browser completes Start order → Drinks → Medium → Pay by card → done with no warnings/errors; scrambled PIN seed 3 renders all keys. Task remains blocked on the physical tablet check.
- 2026-10-28: README audit corrected stale code/tooling status and separated accepted design/reference assets from working features. Verified accepted ADRs 0001/0002/0004/0005; ADR-0003 remains proposed. D1-T1 completion is valid for its root-workspace scope, not a claim that all CI or product functionality is complete.
- 2026-10-28: Final baseline: protocol 46/46 and simulator 14/14 pass; gateway 31/43 pass with 12 D1-T4 TODO failures. `pnpm -r test` exits 1 as expected; all workspace typechecks and current package builds pass. CI run 40562763885 at 4512cdb is red; no claim of full application or CI completion.
- 2026-10-28: Android tooling prerequisite resolved: java/javac 21.0.13 verified; official SDK CLI lists Platform 36 revision 2 and Build Tools 36.0.0. Added scripts/android.sh and docs/local-development.md. D1-T0 accounts/credits/photos/outreach remain pending.
- 2026-10-28: D1-T3 complete: Dockerfile builds under rootless Podman; container /healthz returns status ok/version dev/protocol fp.v1, runtime UID 1000. Verification container removed. All 14 app/session tests and recursive TS typecheck pass.
- 2026-10-28: D1-T7a complete: Android Gradle project copied; red run confirmed 7 CuesTest TODO failures with 5 filter tests passing; cue frequency, pan and magnitude implemented from guidance-spec §§5/7. All 12 JVM tests pass on JDK 21 / Gradle 9.8.2. App shell is the next Android task.
