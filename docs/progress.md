# Progress board

Agents and people both update this file. Keep each line short. Status values are `todo`, `doing`, `blocked` and `done`. Claim a task by setting `doing` and your name, and commit that change on its own (see AGENTS.md §3).

**Current phase:** Day 2 coding resumed by the user on 2026-10-28; all unfinished Day 1 checks remain open · **Plans ready:** Days 1–3 · **Days 4–7:** written each evening from results (design.md §7 has the outline)

**Completion audit (2026-10-28):** [all 37 tasks](task-audit.md). Fourteen tasks are complete within their documented scope; five are partial and 18 are not implemented/executed. Finish every requirement, including required live/device acceptance, before moving past a task unless the user explicitly reprioritizes it. User deferred unfinished T7c; its requirements and the Day 1 exit gate remain open. D2-T1 was pulled forward as a Day 1 CI foundation; D2-T2–T6 are complete under the user-directed phase exception; T7 coding is verified but required live acceptance remains blocked.

**Day 1 readiness audit:** [full task and exit-check evidence](evals/day1-completion-audit.md), updated after engineering fixes `5d4a5aa`, `d0a4ed3` and `a27887d`. **Not complete:** 8/12 original Day 1 tasks complete; T0, T5, T6 and T7c remain blocked. The additional pulled-forward D2-T1 is complete. Only 1/5 exit checks passes (CI); tracking performance fails and real-photo quality, region decision and tablet acceptance remain unfulfilled.

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
| D1-T7d | Tone prototype | A | T7c | done | Codex |
| D2-T1 (pulled forward) | Kotlin protocol foundation required by Day 1 CI | A | D1-T2, D1-T7a | done | Codex |
| D1-T8 | CI green + tester docs | C | T1, T7b, D2-T1 | done | Codex |

## Day 2: `docs/superpowers/plans/2026-10-28-day2-closed-loop.md`
The existing D2-T1 protocol task is tracked above as a Day 1 CI prerequisite. On 2026-10-28 the user explicitly requested "Start implementing Day 2 now" after being told that Day 1 remains incomplete. This authorizes starting Day 2 while retaining all unfinished Day 1 requirements and statuses. Individual task prerequisites and completion checks still apply; no Day 1 exit check is marked passed by this exception. The later instruction "Finish Day 1 first completely" supersedes permission to continue Day 2: retain completed T2/T3, but resumed no further Day 2 task until the user subsequently requested “So start implementing Day 2 coding”. That latest instruction authorizes independent Day 2 coding while every unfinished Day 1 requirement stays open.

| Task | What | Lane | Depends on | Status | Owner |
|---|---|---|---|---|---|
| D2-T2 | Target zones, fingertip | A | D1-T7a | done | Codex |
| D2-T3 | Phrases, speech queue | A | D2-T2 | done | Codex |
| D2-T4 | Guidance state machine | A | D2-T3 | done | Codex |
| D2-T5 | Goal → element resolution | B | D1-T4 | done | Codex |
| D2-T6 | Session pipeline | B | D2-T5 | done | Codex |
| D2-T7 | Controller, ASR relay, sim relay | B | D2-T6 | blocked | Codex |
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
- Day 2 simulator route protection is now implemented and locally tested: live mode omits the route without SIM_TOKEN, and configured tokens use constant-time comparison. It has not been deployed; Day 3 authentication/kill-switch protections above remain asset-only.

## Blockers
_(task id · exact command · last lines of output · what you tried)_

- D2-T7 · Coding/local verification complete; required live acceptance and regional redeployment remain blocked by human credentials and unaccepted ADR-0003. Safe preflight `node --conditions=source --input-type=module -e 'import { loadConfig } from "./services/gateway/src/config.ts"; try { loadConfig({ ...process.env, MODEL_MODE: "live" }); } catch (e) { console.log(e.message); process.exitCode = 2; }'` exits 2: `Invalid gateway config: META_API_KEY: META_API_KEY is required when MODEL_MODE=live`. Root `.env` is absent; no live model request or deployment was attempted. ADR-0003 remains proposed. Supply credentials privately, finish D1-T5 regional evidence, then run T7 Steps 4/5. No task progression past this acceptance gate. See [Day 2 coding evidence](evals/day2-coding.md).

- D1-T7c · User resumed controlled profiling and supplied a comparison phone on 2026-10-28. Added fused crop/rotate/resize, callback-image cleanup, keep-awake and numeric diagnostics. Two valid comparison checks still fail: CPU/two hands with no hand visible: 11–14 fps / 45–61 ms, rolling max 67 ms; GPU/two hands with one pointing hand consistently detected: 10–12 fps / 43–86 ms, rolling max 87 ms. Required: ≥25 fps / ≤25 ms. Both full comparison runs reported thermal status 1, so an unthrottled comparison remains missing. Model-task latency remains high; callback queue delay is negligible. Production defaults remain GPU/two hands. Prior visual acceptance passed on the earlier build; fused-build visual regression and camera-screen TalkBack recheck remain pending. Further performance attempts stopped under AGENTS.md §9 after the two resumed budget failures. User explicitly deferred this unfinished task to allow T7d; subsequent Day 1 preparation did not waive its acceptance gate. Subsequent user-authorized USB reconnect: one authorized phone with the current APK; shell transport completed both new captures. GPU/one hand: 9–12 FPS / 52–109 ms; GPU/two hands: 5–8 FPS / 107–167 ms, rolling max 167 ms (exit 1). Both report thermal status 3; intermittent hand loss in the one-hand run prevents an isolated comparison. The user postponed the fused visual/TalkBack checks. Next T7c work: controlled unthrottled/native-task investigation and the deferred manual regression. See [profiling report](evals/day1-tracking-profile.md) and [device report](evals/day1-device.md). Original failed probes are retained below.

<details>
<summary>D1-T7c: resumed comparison commands and final 30 lines of GPU/two-hand output</summary>

```bash
python3 scripts/profile-android-tracking.py --serial-file /tmp/fingerpost-comparison-device --delegate CPU --hands 2 --warmup-seconds 5 --seconds 15 --check-budget > /tmp/fingerpost-profile-new-cpu2.json
python3 scripts/profile-android-tracking.py --serial-file /tmp/fingerpost-comparison-device --delegate GPU --hands 2 --warmup-seconds 5 --seconds 15 --check-budget > /tmp/fingerpost-profile-new-gpu2-one-visible.json
```

Both exit 1 (`budget_pass: false`); complete numeric output is saved in docs/evals/day1-tracking-profile-data.json. Last 30 lines of the GPU/two-hand JSON:

```text
      1
    ],
    "sample_count": 14,
    "sampled_callback_ms": {
      "max": 0,
      "median": 0.0,
      "min": 0,
      "p95": 0
    },
    "sampled_inference_ms": {
      "max": 86,
      "median": 59.0,
      "min": 43,
      "p95": 86
    },
    "sampled_prepare_ms": {
      "max": 9,
      "median": 4.0,
      "min": 2,
      "p95": 9
    },
    "sampled_submit_ms": {
      "max": 3,
      "median": 1.0,
      "min": 0,
      "p95": 3
    },
    "window_inference_max_ms": 87
  }
}
```

</details>

- D1-T7c / diagnostic capture · `python3 scripts/profile-android-tracking.py --serial-file /tmp/fingerpost-comparison-device --delegate GPU --hands 1 --warmup-seconds 5 --seconds 15 > /tmp/fingerpost-profile-new-gpu1-one-visible.json` emitted `{"error": "App log stream ended before profiling completed"}` (exit 1). An earlier default-buffer capture had the same interruption; main-buffer selection helped but did not eliminate it. App remained running afterward. Interrupted captures were discarded. The later USB reconnect below resolves capture for two full runs via explicit shell transport, including a valid one-hand diagnostic; its severe thermal state and intermittent hand loss still do not prove the repeated-palm-detection hypothesis. A separate asleep-phone attempt was discarded; visible-preview keep-awake and CLI awake preflight were added, and retained runs stayed awake.

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

- D1-T0 · Only the tooling item is verified (1/8 top-level items). Account/credit/cloud/registry/name/photo/outreach requirements lack recorded completion evidence; local .env and Day 1 photo dataset are absent. Human-only setup remains required.
- D1-T5 · Offline smoke/privacy and deployment preparation is verified. Live command `node --conditions=source services/gateway/scripts/smoke-meta.ts` exits 2: `META_API_KEY missing (configure the ignored local environment first)`. No local key or Day 1 JPEG dataset is available; gcloud is absent on PATH. T0 credentials/photos/cloud setup and actual live evaluation/deployment remain required. Deployment orchestration has local stub tests only.
- D1-T5 / regional evidence · Step 7 now follows ADR-0003 total-flow selection; RTT+Spark alone cannot choose the region. Both the fixed-box diagnostic and the new controlled binary-target/ASR handshake tooling are implemented and mock-tested. No real candidate deployments, accepted-handshake timings or 20-sample live binary-target evidence have been collected. Keep ADR-0003 proposed; no region chosen.
- D1-T0 / outreach · T8 drafts and the private consent/session procedure are prepared. A human must verify contact routes and perform outreach; all tracker entries remain unsent. r/Blind currently excludes this recruitment and cannot count toward the 10-group requirement. The session agenda now totals 45 minutes.



## Deviations from the plan
- D2-T7 · Merge the finished app/config/package additions into the existing gateway to preserve regional routes, overrides, scripts and debug-token redaction. Correct the finished registry unsubscribe closure so a repeated old unsubscribe cannot delete a new subscription for the same run; regression test included. Follow protocol.md abort → finish and Meta’s documented instruction to ignore lifecycle/unknown ASR event types. No supplied test was changed.
- D2-T4 · User resolved the DONE conflict: wait for actual speech completion. Corrected the plan and supplied happy-path test/asset, added correlated completion ids and a SpeechDone event, and retained all other expectations/timings. Pure JVM implementation only; Android TTS callback wiring remains T10c.
- D1-T5 · User explicitly requested finishing the coding portion without live prerequisites. Added a private exact-label benchmark using existing fp.v1 messages, plus ASR connection probing with Node 24 native WebSocket. No public contract, dependency, model/version or Day 2 production pipeline was changed; real evaluation/deployment remains blocked.
- D2-T3 · Clarified the plan's interruption rule using authoritative guidance-spec §5: the 700 ms gap applies even when GUIDE outranks current INFO. STATE/SAFETY speech can still interrupt immediately. Six boundary tests added; no supplied tests or timing values changed.
_(task id · what changed · why · who approved)_
- D1-T5 · User-requested Day 1 audit/fixes prepared safe smoke inputs/outputs and deployment orchestration offline before the blocked live steps. Use the documented Cloud Build config fallback instead of unsupported builds-submit --file; keep real latency samples in ignored private storage. Align Step 7 with ADR-0003 total-flow selection without choosing a region or dropping Voice Transcribe evidence. No paid/cloud call or phase advancement.
- D1-T8 / D2-T1 · On the user's continuation request, reconcile the documented CI cycle by executing the existing Kotlin protocol foundation before Day 1 T8. Retain its id, assets, pinned dependencies and full contract tests; no other Day 2 work or phase advancement. T7c stays unfinished. Prepare T8 outreach materials before T0's human outreach, and correct T8's 50-minute total to the required 45 minutes with a 5-minute interview.
- D1-T7d · User explicitly instructed on 2026-10-28 to leave T7c unfinished and implement T7d. T7c stays blocked with its performance/acceptance boxes open; this is a scoped dependency-order exception, not a completed prerequisite or permission to advance phases.
- D1-T7d · Retain the plan's explicit prototype formula: frequency rises as image x increases. Correct the contradictory device-check wording ("moves left") to "moves right"; no formula, guidance threshold or product decision changes.
- D1-T1 · The referenced superpowers workflow skills are not installed; Codex follows the complete repository task checklist directly under the user’s autonomous-development instruction. No dependency or product changes.
- D1-T1 · System Node 22/pnpm 11.25 were not used: checks use bundled Node 24.22.1 and isolated pnpm 11.10.0 in /tmp. Git commits use Codex <codex@fingerpost.invalid> because no author identity is configured; no global configuration changed.

- D1-T3 · Omitted literal `--` from targeted pnpm test commands: the documented command ran all 43 gateway tests, including D1-T4. Corrected `pnpm --filter @fingerpost/gateway test app session` selects the intended 14 tests.
- D1-T3 · Removed Docker COPY lines for unrelated web/evals manifests (evals does not yet exist); gateway dependency installation only needs the protocol and gateway workspaces. Subsequent container verification passed with the isolated Podman store (see Log).

- D1-T3 · User resolved the size-limit conflict on 2026-10-28: use `bad_message` for oversized text/keyframes and update the protocol prose to match existing tests. No message schema or Kotlin model changes are needed.

- D1-T3 · Replaced the skeleton constructor parameter property with an explicit field assignment after `pnpm --filter @fingerpost/gateway dev` failed with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` under Node 24 strip-only execution. Public interface unchanged.

- D1-T0 · User explicitly authorized laptop tooling setup on 2026-10-28. Installed checksum-verified Temurin JDK 21.0.13+9, official Android command-line tools and Platform 36; retained Build Tools 36.0.0 and existing SDK/Studio. Pinned pnpm 11.10.0 now persists under ~/.local/share/fingerpost/node-tools. Project launcher selects tools without changing Java for other apps.

- D1-T3 · Container verification used installed rootless Podman with the same Dockerfile instead of installing Docker. Its default database referenced the old /home/namanhere23 path; a separate ~/.local/share/fingerpost/containers store avoids changing existing containers. Build, mock health response and non-root UID 1000 verified.

- D1-T7b · First app build required compile SDK >=37 for pinned Compose/Core artifacts. Applied the task’s first-build config-fix provision: compileSdk 37, minimum SDK 29 and target SDK 36. Pinned dependencies and build checks retained; design technical default and launcher updated. Future asset applications must retain this correction.

- D1-T7c · Followed authoritative guidance-spec §3's 640×480 input instead of the plan's fixed 640-pixel width: aspect-preserving letterbox and inverse mapping also handle portrait frames without stretching or exceeding that input size. Six JVM projection tests added test-first; detector defaults now recorded in the spec. No dependency changes.
- D1-T7c · Resumed profiling adds an optional raw AnalysisFrame callback while preserving the planned upright Bitmap callback and sample coordinate space. Crop/rotation/downscale now share one draw, avoiding the measured full-resolution intermediate. Debug-only delegate/hand-count overrides support controlled comparisons; release overrides are ignored. Added an optional standard-library Python diagnostic tool, not an app/build dependency. No pinned versions, guidance thresholds or production hand limit changed.


## Measurements
| Date | What | Value | Where |
|---|---|---|---|
| 2026-10-28 | Kotlin guidance tests | 85 passed, 0 failures/errors/skips (37 Day 1 +26 geometry/target/fingertip +22 planner/speech) | apps/android/core/guidance/build/test-results/test |
| 2026-10-28 | Kotlin protocol tests | 49 passed, 0 failures/skips; shared valid/invalid fixtures plus framing boundaries | apps/android/core/protocol/build/test-results/test |
| 2026-10-28 | Deployment preparation | five synthetic orchestration tests pass; no real cloud calls | scripts/test_deploy_gateway.py |
| 2026-10-28 | TypeScript protocol tests | 48 passed, including two added invalid base-field fixtures | packages/protocol |
| 2026-10-28 | Numeric profiling tool | 24 tests pass; shell transport, numeric-only capture/cleanup, EOF rejection and unchanged GPU acceptance | scripts/test_profile_android_tracking.py |
| 2026-10-28 | TypeScript tests | 205 passed (protocol 48, gateway 143, web 14) | pnpm -r test |
| 2026-10-28 | CI at protocol foundation a94f5de | ts and android jobs successful; original test/build steps retained | GitHub Actions run 40615429726 |
| 2026-10-28 | CI at T8 implementation 9102c2c | ts and android jobs successful; frozen install, typecheck, all tests and app build pass | GitHub Actions run 40616176301 |
| 2026-10-28 | CI at audit/fixes 2480252 | ts/android successful, including 27 Python tooling tests; all original checks retained | GitHub Actions run 40647979193 |
| 2026-10-28 | Gateway container | expected health JSON; UID 1000 | rootless Podman build/run |
| 2026-10-28 | Android shell | build/install/launch pass; permission and TalkBack device acceptance confirmed | apps/android/app/build/outputs/apk/debug/app-debug.apk |
| 2026-10-28 | Android tracking, second GPU run | 8–11 fps; sampled inference 45–92 ms; worst window 96 ms; performance gate FAIL | docs/evals/day1-device.md |
| 2026-10-28 | Comparison phone, optimized GPU/two hands | one pointing hand detected; 10–12 fps / 43–86 ms; rolling max 87 ms; gate FAIL | docs/evals/day1-tracking-profile.md |
| 2026-10-28 | Tone prototype device acceptance | user confirms pitch/pan, no clicks, TalkBack toggle, hand/background mute; response feels prompt (subjective) | docs/evals/day1-tone.md |

## Log
- 2026-10-28: User-requested environment setup correction: added root .env.example with valid mock defaults and inactive secret/measurement placeholders, plus private-copy/loading and Secret Manager instructions. Node 24 parsing and existing gateway validation pass; live mode without a key still fails, shell syntax passes, and Git ignores .env/.env.local while allowing the example. No private environment file was read or modified, no network/model request made, and task completion/blocker statuses remain unchanged.
- 2026-10-28: User explicitly requested starting Day 2 with Day 1 unfinished. Begin at D2-T2, whose D1-T7a prerequisite is done, and retain every Day 1 blocker/acceptance requirement. Individual Day 2 completion checks remain mandatory; no deployment, live model access or device acceptance is implied.
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
- 2026-10-28: User resumed D1-T7c profiling and supplied a comparison phone. Implemented fused crop/rotate/letterbox, distinct callback-image cleanup, visible camera keep-awake, debug-only comparison options and bounded numeric profiling CLI with private device targeting. Red-first checks: 7 new geometry tests and profiling tests; all 25 JVM +18 Python tests pass; app:test (no source cases), assembleDebug and lintDebug pass. Final APK installed/opened on the comparison phone. Valid CPU/two-hand and GPU/two-hand pointing-hand captures miss the unchanged budget; interrupted streams and asleep-phone runs discarded. Source/driver/native-task cause remains unresolved. Evidence in docs/evals/day1-tracking-profile.md and sanitized JSON. Task blocked; T7d not started; no camera content exported.
- 2026-10-28: User-requested keep-awake follow-up: moved screen holding from the camera preview to MainActivity's visible window, covering the permission screen too. Guidance tests (25), app:test (no source cases), assembleDebug and lintDebug pass; lint has 0 errors/4 existing advisories. Updated both connected test phones. Comparison phone stayed awake/focused for 125.2 seconds beyond its unchanged 120-second timeout; Home released the screen hold after transition, and reopening restored it. No system sleep setting changed or camera content exported. Evidence: docs/evals/day1-device.md. T7c remains blocked on its existing acceptance requirements; no next task started.
- 2026-10-28: User explicitly deferred unfinished T7c and requested T7d. Implemented the pure-JVM oscillator, thread-safe AudioTrack output, valid-fingertip mapping, single TalkBack toggle/state, no-hand mute and lifecycle release. Twelve expected TODO failures confirmed first; all 37 guidance tests, app:test (no source cases), debug build and lint pass. Updated APK installed on both connected test phones. Listening, TalkBack toggle and perceived-latency acceptance remain pending; T7d is not done. Evidence: docs/evals/day1-tone.md. No performance acceptance requirement was reduced.
- 2026-10-28: D1-T7d complete: user confirmed tone/pitch/stereo pan, click-free TalkBack off/on toggling, no-hand/background silence and prompt perceived response. Numeric device state corroborates 48 kHz AudioTrack initialization, low-latency mode and TalkBack enabled. All 37 guidance tests and final app build/lint checks pass; app:test has no source cases. Implementation saved in 1e51a15; acceptance in docs/evals/day1-tone.md and docs/evals/day1-device.md. Acoustic/end-to-end latency was not instrumentally measured. T7c remains unfinished; no further task started.
- 2026-10-28: Continued after T7d; resolved the Day 1 CI ordering cycle by pulling forward the existing D2-T1 foundation. Red baseline: 35 TODO failures/6 passes, then 6 additional boundary-test TODO failures. Implemented strict server parsing with content-free errors, client encoding/base-field validation and unsigned big-endian/strict-UTF-8 binary framing. All 49 Kotlin protocol tests, 37 guidance tests, 48 TS protocol tests, recursive TS typecheck and app debug build pass. Finished model/config/fixture assets retained; added two synthetic invalid fixtures without changing the wire schema. Day 1 remains open; next is T8 docs and actual CI verification.
- 2026-10-28: D1-T8 materials prepared: weekly Dependabot config, 45-minute session protocol, English/Hindi consent and six outreach drafts, organization-only unsent tracker. YAML, word limits, agenda, consent structure and local links verified. Current simulator temporary tap logging is disclosed; no export without consent and no promise of a recording-off switch. r/Blind draft marked do not post under current rules; no outreach sent. All 105 TS tests pass. CI run 40615429726 at a94f5de is green in both jobs; T8 remains doing until its document commit is pushed and checked.
- 2026-10-28: D1-T8 complete: implementation 9102c2c pushed; `gh run watch 40616176301 --interval 15 --exit-status` and run details confirm both ts/android jobs successful. Local checks: 105 TS tests, 49 Kotlin protocol tests, 37 guidance tests, recursive typecheck and app build pass; YAML/doc requirements verified. No CI checks disabled, pinned versions upgraded, messages sent or tester outcomes invented. Day 1 still lacks T7c performance, T5 live photo/model/region validation and T6 tablet acceptance. Human setup/outreach remains open; no closed-loop phase work started.
- 2026-10-28: User-requested Day 1 readiness audit at 5d002e7 confirms 8/12 original tasks complete plus the pulled-forward D2-T1 foundation; 1/5 exit checks passes. Fresh TS checks/build/schema export and 18 Python tests pass; forced JVM rerun passes 37 guidance +49 protocol tests with no failures/skips. App build/lint succeeds using up-to-date outputs, with no app unit-test sources and four lint warnings. Exact-revision CI run 40616491789 is green in both jobs. Verified model/APK integrity, unchanged reference tests and tester-document checks. Recorded T5 measurement discrepancy; no live/device acceptance, task completion or phase advancement claimed. See docs/evals/day1-completion-audit.md.
- 2026-10-28: D1-T5 offline preparation verified: 16 smoke/JPEG TODO failures and 27 regional TODO/regression failures confirmed first, then all 94 gateway tests and 156 total TS tests/typecheck/build pass. Added five passing deployment orchestration tests after the expected stub failures; shell/YAML checks pass. Rebuilt gateway container returns correct mock health, numeric debug metrics, invalid-sample 400 and UID 1000; removed the verification container. Raw photos/overlays and recognized labels stay out of committable reports; model errors are content-free. Deployment script is prepared (Step 3), but no real GCP/model call, quality pass or region acceptance occurred. T5 remains blocked on T0 and missing Voice Transcribe/total-flow evidence.
- 2026-10-28: D1-T7c audit follow-up: four new synthetic tooling tests exposed CPU acceptance, missing awake evidence and insufficient-window loopholes before correction. All 22 tracking-tool tests and five deployment-tool tests pass; CI now runs both. Thresholds remain GPU/two hands, ≥25 FPS and ≤25 ms. Device inventory reports zero connected devices; no performance, visual or TalkBack acceptance was repeated and the capture-termination cause remains unresolved. T7c stays blocked.
- 2026-10-28: Day 1 audit/fixes retain 8/12 original tasks complete plus the pulled-forward Kotlin protocol foundation. T5 now has verified offline preparation (1/8 steps) but remains blocked; overall board is 9 complete, 4 partial and 24 unimplemented. Fresh validation: 156 TS, 86 Kotlin and 27 Python tests pass; typechecks/builds/schema export, Android build/lint, model/APK checks and rebuilt mock container pass. No raw captures, live model result, deployment, new device acceptance or phase advancement claimed. New remote CI validation is pending.
- 2026-10-28: Audit/fixes revision 2480252 pushed; `gh run watch 40647979193 --interval 15 --exit-status` exits 0 and run details confirm both ts/android jobs successful, including Python tooling checks. Day 1 remains 8/12 original tasks complete and 1/5 exit checks passed; T0/T5/T6/T7c stay blocked. No performance or live-quality result was invented.

- 2026-10-28: User reconnected an authorized USB phone with the current APK. Corrected profiling transport after red-first command regression; all 24 tracking +5 deployment tests pass. Camera-free shell probes stayed open for 5/20 seconds, then both 5-second warm-up +15-second app captures completed (14 tracker/15 camera windows each). GPU/one hand: 9–12 FPS / 52–109 ms, intermittent hand loss; GPU/two hands: 5–8 FPS / 107–167 ms, rolling max 167 ms, budget false (exit 1). Both thermal readings were 3; idle cooling reached only 2. Camera stopped after diagnostics; user deferred visual/TalkBack checks until later. T7c remains blocked, production defaults and Day 1 exit gate unchanged; no further speed attempt or task advancement. Full generic numeric evidence is appended to the profiling report/data.

- 2026-10-28: D2-T2 complete: copied the finished geometry implementation and original tests unchanged; confirmed 10 expected target/fingertip TODO failures and six additional boundary failures before implementation. Added iso-space target zones/error, hysteresis/reset, fingertip pad compensation, valid/nearest hand selection and off-screen bounds. `./scripts/android.sh :core:guidance:test --console=plain` passes all 63 cases with 0 failures/errors/skips. Pure JVM scope only; app wiring and Day 1 acceptance remain pending.

- 2026-10-28: D2-T3 complete: confirmed nine supplied phrase/queue TODO failures plus six boundary failures, then implemented English rendering and priority/cadence/freshness queue with clear/reset. Finished CuePlanner and both supplied test files remain unchanged; unsupported locales fail explicitly. `./scripts/android.sh :core:guidance:test --console=plain` passes all 85 cases with 0 failures/errors/skips. No Android TTS adapter is wired yet; that remains T10c.

- 2026-10-28: D2-T2 implementation 9a931c8 and D2-T3 caf62d0 are pushed using the requested author. Both exact-revision CI runs pass; latest [run 40653225580](https://github.com/Sky-walkerX/fingerpost/actions/runs/40653225580) confirms ts/android success. Final local checks: 85 guidance cases (0 failures/errors/skips), unchanged 49-case protocol check, Android debug compatibility build, recursive TS typecheck and all 156 TS cases pass. Finished Geometry/CuePlanner assets and all five supplied Day 2 test files match their originals. D2-T4 remains blocked before copying/implementation on the quoted DONE transition conflict; no later task or Day 1 completion claimed.

- 2026-10-28: User restored Day 1 as the priority and asked for full completion before more Day 2 work. Retain completed T2/T3 without advancing further. Fresh readiness: zero authorized/unauthorized ADB devices; local .env absent, Meta key not present in the environment, zero Day 1 JPEGs, no private latency crop and no gcloud on PATH. Asked for device availability and human setup status; preparing the missing local Cloud CLI within T0 tooling scope. No live/device check or task completion claimed.

- 2026-10-28: D1-T5 measurement coding complete after failing-first ASR/route/client/CLI and bounded-queue checks. Added gateway ASR upgrade/accepted-handshake timings, actual binary keyframe → validated target timing with exact-label selection/SAM and a two-candidate matrix. All 143 gateway and 205 TS cases, recursive typecheck/builds and two compiled-gateway mock exchanges pass. Native localhost integration sends no real image/audio and makes no external model call. Existing tests/pinned dependencies/public schemas are preserved. Live prerequisites and 20-sample evidence are still missing, so T5 stays blocked, Step 6/ADR remain unaccepted and Day 2 stays on hold. Earlier Cloud CLI download was interrupted; no completed Cloud CLI installation is claimed.

- 2026-10-28: Regional tooling implementation cd3aed5 pushed with the requested Git author; [CI run 40658914167](https://github.com/Sky-walkerX/fingerpost/actions/runs/40658914167) succeeds in both ts/android jobs, including the 205 TS cases, existing Python/JVM checks and app build. Working implementation is verified; no live measurement, new task completion or ADR acceptance claimed.

- 2026-10-28: User explicitly resumed Day 2 coding with Day 1 unfinished. D2-T5 complete after seven supplied and ten additional boundary TODO failures: deterministic exact/fuzzy alias matching, ambiguity handling, position words and label lists implemented. All 160 gateway cases and recursive TS typecheck pass; existing localhost integration cases require socket permission. Original match tests unchanged; no dependency or public contract change. User also resolved D2-T4: wait for actual speech completion and correct the plan/test before implementation.

- 2026-10-28: D2-T4 complete after 15 supplied TODO failures and 11 additional boundary TODO failures (queue metadata case already passed). Implemented the Day 2 state machine, retries, no-hand prompts, target hysteresis and verification; DONE waits for its correlated terminal speech callback and rejects stale completions. User-authorized plan/test correction replaces the contradictory fixed timer. All 112 guidance cases pass with zero failures/errors/skips; protocol check and app:test/assembleDebug succeed (app tests have no source cases). No device behavior or TTS wiring acceptance claimed.

- 2026-10-28: D2-T6 complete after nine supplied plus ten boundary TODO failures and a separate null-confidence regression. Implemented layout fingerprints/Jaccard, goal/locale state, task gates/usage hooks, locate/clarify/SAM target and verify/touch consumption. Protocol-validated outputs bound long ask text/options; no new dependency or public wire change. All 180 gateway/242 total TS cases, recursive typecheck and production builds pass. Constructor uses an explicit field for Node 24 strip-only compatibility. Supplied tests and finished quota/error assets retained; production session wiring is T7, Android wiring is T10.

- 2026-10-28: D2-T7 coding/local checks complete after nine supplied and thirteen additional TODO failures, plus lifecycle/abort regressions. Implemented Standard ASR handshake, bounded pre-open audio, partial/final/error relay, controller/usage hooks, cancellation and run-scoped sim delivery. Preserved ordered per-session processing and Day 1 measurement endpoints. All 205 gateway/267 total TS cases, recursive typecheck/build pass; source and compiled gateways complete real localhost mock voice→target→sim press→verify exchanges. Only planned ws 8.22.0 added (existing lock entries unchanged). Required live preflight fails without META_API_KEY; ADR-0003 is proposed, so Steps 4/5 remain unverified and T7 stays blocked. No new device test, paid/cloud call or later task started. Remote CI verification pending.

- 2026-10-28: T7 implementation d57a84d passes both CI jobs ([run 40663838009](https://github.com/Sky-walkerX/fingerpost/actions/runs/40663838009)). Final review exposed trailing audio reopening ASR after failure/endpointing final; two added red assertions reproduce it. Controller now waits for audio.end before permitting a new utterance, preserving one spoken retry and avoiding unintended extra requests. Live acceptance remains blocked.

- 2026-10-28: Final Day 2 implementation c1be57e pushed with the requested author; [CI run 40664266695](https://github.com/Sky-walkerX/fingerpost/actions/runs/40664266695) succeeds in both ts/android jobs. Final local TS validation: 268 cases (206 gateway/48 protocol/14 web), recursive typecheck/build pass. CI retains frozen installation, all 29 Python tooling cases, 112 guidance/49 Kotlin protocol cases and app debug build. T4/T5/T6 complete; T7 remains blocked solely on required live acceptance/redeployment prerequisites. No unfinished Day 1 gate or Android closed-loop integration is marked complete.
