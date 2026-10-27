# Progress board

Agents and people both update this file. Keep each line short. Status values are `todo`, `doing`, `blocked` and `done`. Claim a task by setting `doing` and your name, and commit that change on its own (see AGENTS.md §3).

**Current phase:** Day 1 foundations (planned Tue Oct 27; still in progress Oct 28) · **Plans ready:** Days 1–3 · **Days 4–7:** written each evening from results (design.md §7 has the outline)

**Completion audit (2026-10-28):** [all 37 tasks](task-audit.md). Six tasks are complete within their documented scope; three are partial and 28 are not implemented/executed. Finish every requirement, including required live/device acceptance, before moving past a task. Blocked work must be reported rather than skipped. Day 1's exit gate is not met; Days 2–3 have not started.

## Day 1: `docs/superpowers/plans/2026-10-27-day1-foundations.md`
| Task | What | Lane | Depends on | Status | Owner |
|---|---|---|---|---|---|
| D1-T0 | Accounts, Android Studio, photos, tester outreach (human) | all | – | blocked | Human |
| D1-T1 | Monorepo root | – | – | done | Codex |
| D1-T2 | packages/protocol | B | T1 | done | Codex |
| D1-T3 | Gateway: config, hub, app, container | B | T2 | done | Codex |
| D1-T4 | Spark parse + SAM adapters | B | T3 | done | Codex |
| D1-T5 | Live smoke, deploy, region (ADR-0003) | B | T0, T4 | blocked | Codex |
| D1-T6 | Kiosk simulator v0 | C | T1 | blocked | Codex |
| D1-T7a | Gradle + core:guidance cue math | A | T0 (JDK) | done | Codex |
| D1-T7b | App shell (Compose, TalkBack, permission) | A | T7a | done | Codex |
| D1-T7c | CameraX + MediaPipe fingertip overlay | A | T7b | blocked | Codex |
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

- D1-T7c · Device performance gate failed twice. GPU run 1 measured roughly 6–16 fps / 43–180 ms after startup. Reusing the model input bitmap, skipping conversion while inference is busy, and backgrounding the app between builds did not resolve it: run 2 measured 8–11 fps / 45–92 ms after five warm-up windows (worst window latency 96 ms). Required: ≥25 fps and ≤25 ms. Light thermal throttling was observed during run 1; its contribution is unproven. User confirmed visual fingertip following in both orientations and disappearance when the hand leaves view (2026-10-28); camera-screen TalkBack recheck remains pending. Stop further attempts/task progression under AGENTS.md §9; resume with a controlled device-performance investigation. Details: [device report](evals/day1-device.md).

<details>
<summary>D1-T7c: exact second-probe command and last 30 lines (all available)</summary>

```bash
python3 - <<'PY'
import os, re, subprocess
from pathlib import Path
adb=str(Path(os.environ.get('ANDROID_HOME',str(Path.home()/'Android/Sdk')))/'platform-tools/adb')
pid=subprocess.check_output([adb,'-d','shell','pidof','io.github.fingerpost'],text=True).strip()
assert pid, 'Fingerpost is not running'
p=subprocess.Popen([adb,'-d','logcat','--pid='+pid,'-T','1','-v','raw','-s','FingerpostTracker:I','*:S'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 out,err=p.communicate(timeout=25)
except subprocess.TimeoutExpired:
 p.terminate()
 out,err=p.communicate()
lines=[line for line in out.splitlines() if line.startswith('delegate=')]
print('\n'.join(lines[-30:]))
rows=[tuple(map(int,re.search(r'fps=(\d+) inferenceMs=(\d+) maxMs=(\d+) hands=(\d+)',line).groups())) for line in lines[5:]]
assert rows, 'No steady-state measurements'
print('After five logged warm-up windows:')
print(f'{len(rows)} windows; fps={min(r[0] for r in rows)}..{max(r[0] for r in rows)}; inferenceMs={min(r[1] for r in rows)}..{max(r[1] for r in rows)}; worst window maxMs={max(r[2] for r in rows)}; windows with hands={sum(r[3]>0 for r in rows)}')
if not all(r[0]>=25 and r[2]<=25 for r in rows):
 raise SystemExit('FAIL: D1-T7c requires >=25 fps and <=25 ms inference')
print('PASS: D1-T7c performance budget')
PY
```

Exit 1:

```text
FAIL: D1-T7c requires >=25 fps and <=25 ms inference
delegate=GPU fps=9 inferenceMs=78 maxMs=85 hands=1
delegate=GPU fps=9 inferenceMs=81 maxMs=81 hands=1
delegate=GPU fps=9 inferenceMs=77 maxMs=90 hands=1
delegate=GPU fps=9 inferenceMs=103 maxMs=103 hands=1
delegate=GPU fps=9 inferenceMs=77 maxMs=82 hands=1
delegate=GPU fps=9 inferenceMs=74 maxMs=80 hands=1
delegate=GPU fps=9 inferenceMs=77 maxMs=79 hands=1
delegate=GPU fps=10 inferenceMs=46 maxMs=82 hands=0
delegate=GPU fps=11 inferenceMs=45 maxMs=54 hands=0
delegate=GPU fps=9 inferenceMs=54 maxMs=55 hands=0
delegate=GPU fps=9 inferenceMs=80 maxMs=80 hands=0
delegate=GPU fps=9 inferenceMs=81 maxMs=84 hands=0
delegate=GPU fps=9 inferenceMs=49 maxMs=82 hands=0
delegate=GPU fps=9 inferenceMs=54 maxMs=74 hands=0
delegate=GPU fps=9 inferenceMs=65 maxMs=87 hands=0
delegate=GPU fps=9 inferenceMs=75 maxMs=82 hands=0
delegate=GPU fps=9 inferenceMs=54 maxMs=65 hands=0
delegate=GPU fps=9 inferenceMs=58 maxMs=82 hands=0
delegate=GPU fps=9 inferenceMs=70 maxMs=82 hands=0
delegate=GPU fps=8 inferenceMs=66 maxMs=83 hands=0
delegate=GPU fps=9 inferenceMs=92 maxMs=92 hands=0
delegate=GPU fps=8 inferenceMs=85 maxMs=90 hands=0
delegate=GPU fps=8 inferenceMs=58 maxMs=82 hands=0
delegate=GPU fps=8 inferenceMs=57 maxMs=96 hands=0
delegate=GPU fps=9 inferenceMs=50 maxMs=60 hands=0
After five logged warm-up windows:
20 windows; fps=8..11; inferenceMs=45..92; worst window maxMs=96; windows with hands=2
```

</details>


- D1-T6 · Android tablet acceptance has not been verified. Desktop flow and unit tests pass; tablet fullscreen, fast-food path, three-finger event export and scrambled PIN-pad checks remain pending.


- D1-T5 · Required human setup in D1-T0 (Meta key/credits, real panel photos and GCP billing/projects) has no recorded verification. Adapter fixture tests pass; live smoke/deployment were not attempted.

- D1-T8 / CI · `./scripts/android.sh :core:guidance:test :core:protocol:test --dry-run --console=plain` fails: `Cannot locate tasks that match ':core:protocol:test' as project 'protocol' not found in project ':core'.` This is the D2-T1 module, not yet implemented. Current guidance tests and app build pass individually; CI workflow retained intact.

- D1-T0 · Only the tooling item is verified (1/8 top-level items). Account/credit/cloud/registry/name/photo/outreach requirements lack recorded completion evidence; local .env and Day 1 photo dataset are absent. Human-only setup remains required.
- D1-T5 · Audit found smoke output privacy conflict: the script writes image bytes into SVGs and recognized labels into Markdown under docs/evals, which the plan stages for commit. Fix raw-output handling and retain only sanitized metrics in Git before running real photos. Deployment CLI is also absent locally.
- D1-T8 / phase order · Day 1 CI requires the D2-T1 protocol module, but the Day 2 plan requires Day 1 completion. Reconcile this forward dependency before phase progression; do not bypass the CI check. T0 outreach also depends on missing T8 drafts, and T8's stated 45-minute agenda currently totals 50 minutes.



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

- D1-T7b · First app build required compile SDK >=37 for pinned Compose/Core artifacts. Applied the task’s first-build config-fix provision: compileSdk 37, minimum SDK 29 and target SDK 36. Pinned dependencies and build checks retained; design technical default and launcher updated. Future asset applications must retain this correction.

- D1-T7c · Followed authoritative guidance-spec §3's 640×480 input instead of the plan's fixed 640-pixel width: aspect-preserving letterbox and inverse mapping also handle portrait frames without stretching or exceeding that input size. Six JVM projection tests added test-first; detector defaults now recorded in the spec. No dependency changes.


## Measurements
| Date | What | Value | Where |
|---|---|---|---|
| 2026-10-28 | Kotlin guidance tests | 18 passed, 0 failures/skips (12 existing + 6 projection) | apps/android/core/guidance/build/test-results/test |
| 2026-10-28 | TypeScript tests | 103 passed (protocol 46, gateway 43, web 14) | pnpm -r test |
| 2026-10-28 | Gateway container | expected health JSON; UID 1000 | rootless Podman build/run |
| 2026-10-28 | Android shell | build/install/launch pass; permission and TalkBack device acceptance confirmed | apps/android/app/build/outputs/apk/debug/app-debug.apk |
| 2026-10-28 | Android tracking, second GPU run | 8–11 fps; sampled inference 45–92 ms; worst window 96 ms; performance gate FAIL | docs/evals/day1-device.md |

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
- 2026-10-28: D1-T4 complete: red run confirmed 12 adapter TODO failures; implemented Spark strict-schema parsing/layout normalization and SAM prompting, mask selection and polygon conversion. All 43 gateway tests, recursive typecheck and protocol/gateway builds pass. Fixture/stub tests only; no live API requests or paid calls.
- 2026-10-28: D1-T7b shell implemented: Compose theme, camera permission request, denied-permission settings screen and announcement, lifecycle refresh after Settings, and one merged TalkBack action. `./scripts/android.sh :app:test :app:assembleDebug --console=plain` succeeds with compile SDK 37; app:test has no source cases. APK produced at apps/android/app/build/outputs/apk/debug/app-debug.apk. Device permission/TalkBack checks still pending.
- 2026-10-28: Android debug APK signature verification (v2) and ZIP integrity pass; package io.github.fingerpost, min SDK 29, target SDK 36, compile SDK 37 verified with aapt. All 103 TS tests pass. D1-T7b remains blocked only on phone acceptance; D1-T7c/T7d have not started.
- 2026-10-28: D1-T7b device connection resolved: Galaxy A14 SM-A146B, Android 15/API 35, authorized over USB. `./scripts/android.sh :app:installDebug --console=plain` succeeds (installed on one device); `am start -W -n io.github.fingerpost/.MainActivity` returns Status ok, process running. Awaiting manual TalkBack/permission acceptance before marking done or starting camera tracking. No device serial stored.
- 2026-10-28: Full completion audit added in docs/task-audit.md. Fresh checks: protocol 46, gateway 43, web 14 and Kotlin guidance 12 pass; recursive typecheck, schema export, all current TS builds and app debug build pass. App unit-test task has no source cases. Rebuilt gateway container returns expected health JSON and runs as non-root. Latest inspected CI: TS passes; Android fails on absent core:protocol. No new feature task started; required device/live checks remain open. User completion gate and generic-device reporting rule recorded in AGENTS.md.
- 2026-10-28: D1-T7b acceptance resumed: current guidance/test/build commands pass. User confirmed the exact spoken camera-needed message following denial with TalkBack. App-details settings intent is verified. Recorded evidence in docs/evals/day1-app-shell.md; remaining grant/return and single-session-element checks are pending, so task is not marked done.
- 2026-10-28: D1-T7b complete: user confirmed spoken denial, app-settings navigation, permission grant/return to the black session screen, and one TalkBack session element with the required description. ADB corroborates CAMERA granted=true, TalkBack enabled and MainActivity resumed. Current guidance/test/build commands pass; app unit-test task has no source cases. Evidence: docs/evals/day1-app-shell.md. D1-T7c has not started.
- 2026-10-28: D1-T7c implemented and installed: pinned model checksum/size verified, CameraX lifecycle/rotation/crop pipeline, two-hand GPU tracker with CPU fallback, fingertip overlay and numeric debug telemetry. Six projection tests confirmed red before implementation; all 18 guidance tests, app:test (no source cases), assembleDebug and lintDebug pass. APK contains the verified model. Two GPU performance runs missed the gate; task blocked with exact probe/output above. Visual acceptance remains pending; T7d not started. No camera frames captured or uploaded.
- 2026-10-28: D1-T7c visual acceptance passed: user confirmed the dot follows the index fingertip in portrait/landscape and disappears when the hand leaves view. Updated plan, device report, README and audit. Performance gate and camera-screen TalkBack recheck remain open; task stays blocked. Documentation-only update; no code or new performance measurements.
