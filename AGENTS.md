# AGENTS.md: rules for any coding agent working in this repo

Read this file first, every session. It's short on purpose. Then read `docs/progress.md`.

## 1. What this repo is
Fingerpost guides a blind user's finger to the right spot on a touchscreen. It has three parts:
- an Android app (the real-time "body");
- a TypeScript gateway on Cloud Run (the "brain");
- Meta models: Muse Spark 1.3, SAM 3.1, Voice Transcribe, and Glimmer on Modal.

Product decisions are **locked** in `docs/design.md` §1. Don't change them. If a task seems to need a change, stop and write it under Blockers in `docs/progress.md`.

## 2. Read order
1. `docs/progress.md`: current day, task board, blockers, measurements.
2. **The day plan for the current day:** `docs/superpowers/plans/2026-10-27-day1-foundations.md`, `…-day2-closed-loop.md` or `…-day3-gate-robustness.md`.
3. **Specs, only the sections your task cites:**
   - `docs/guidance-spec.md` (numbers and behaviour of guidance; it is authoritative over design.md);
   - `docs/protocol.md` (messages);
   - `docs/design.md` (architecture);
   - `docs/adr/`.
4. **Plan assets:** `docs/superpowers/plans/assets/dayN/…` mirrors the repo. Copy them with `docs/superpowers/plans/assets/apply.sh <day> <path>…`, which never overwrites your edits without `--force`.
   - Most assets are **finished and verified**: configs, schemas, fixtures, tests, prompts and algorithms. Don't rewrite them.
   - **Skeletons** keep real signatures and doc comments; their bodies throw `TODO(Dn-Tm)`. You write those bodies until the task's tests pass.
   - Planning checked that each day's starting state typechecks and compiles, with only that day's tests failing.

## 3. How to pick up and finish a task
**Completion gate (user requirement):** Finish every requirement of the current task, including its required live/device acceptance and final verification, before starting the next task. Copied assets, passing unit tests or a commit alone do not make a task complete. If a requirement is blocked, record it and tell the user what is needed; do not skip ahead unless the user explicitly reprioritizes the work. Day 2 starts only after Day 1 is complete, and Day 3 only after Day 2 is complete. Resolve contradictory task ordering before advancing a phase; never bypass a check to claim completion.

1. **Choose:** in `docs/progress.md`, take the first task whose status is `todo` and whose "Depends on" tasks are all `done`.
2. **Claim it:** set its status to `doing`, put your name or agent id in "Owner", and commit that one-line change: `chore(progress): claim D1-T2`.
3. **Work:** follow the task's steps **in order**:
   - Test steps come first.
   - Run the "verify it fails" command and confirm the failure matches what the plan says.
   - Implement.
   - Run the "verify it passes" command.
4. **Tick boxes:** mark each `- [ ]` as `- [x]` in the day plan as you finish it.
5. **Finish:** run the task's final verification command(s). Then set the status to `done` in `docs/progress.md`, add one line to the log with what you measured or noticed, and commit using the task's commit message.
6. **Push:** `git pull --rebase` and then `git push`. If the rebase conflicts in `docs/progress.md`, keep both sides' lines.

## 4. Definition of done (all must hold)
- The task's tests pass, and `pnpm -r typecheck` is clean (TS tasks).
- For Android tasks, `./gradlew <module>:test` passes (and `:app:assembleDebug` for app tasks).
- No test was weakened, skipped or deleted to make it pass.
  - If a test contradicts the spec, stop, write a Blocker that quotes both, and leave the task `blocked`.
- No new dependency or version change beyond what the plan lists. If one is unavoidable, record it under "Deviations" in progress.md, with the reason.
- No secrets, image bytes, audio, transcripts or OCR text in code, logs, tests or commits. Fixtures use synthetic data only.

## 5. Hard rules
- **Never commit** `.env`, keystores, `google-services.json` or service-account JSON. The `.gitignore` covers them, so don't override it.
- **Use generic device labels** in commit messages and progress/evaluation notes. Do not add device models, serials or other personal/device-identifying details unless the user explicitly authorizes them.
- **Never use a Meta "contributor" model id** (`*-contributor`). Only Standard mode.
- **Never send camera frames anywhere** except through the gateway path described in the spec. Never upload anything while PIN mode is active.
- **Guidance numbers** (thresholds, timings, frequencies) come only from `docs/guidance-spec.md`. If you need a number that isn't there, add it to the spec in the same commit, marked `initial value`.
- **Protocol changes** touch `packages/protocol` (schemas and fixtures) **and** the Kotlin models in the same PR, and both test suites must pass.
- **Human-only steps:** creating accounts, keys, billing, Play/Apple consoles, and contacting testers. Leave these to people. If your task needs one and it isn't done, mark the task `blocked` with a Blocker line.
- **Don't run** `gcloud … deploy`, `firebase deploy`, or anything that spends money unless your task says so explicitly.

## 6. Toolchain (pinned; don't upgrade)
| Tool | Version |
|---|---|
| Node | 24.x (repo verified on 24.18.0) |
| pnpm | 11.10.0 (`packageManager` field) |
| TypeScript | 7.0.2 |
| zod | 4.6.7 |
| vitest | 5.0.5 |
| vite | 8.3.5 |
| fastify | 5.12.7, @fastify/websocket 11.3.4 |
| openai | 7.32.0 (the Meta Model API is OpenAI-compatible; 7.45.0 was too new for pnpm's release-age policy) |
| @meta-sam/parser | 0.1.0 |
| From Day 3 | pkijs 3.4.1, asn1js 3.0.10 (forced by `overrides`), jose 6.2.12, firebase-admin 14.5.0 |
| JDK | 21 (Android Studio's bundled JBR is fine) |
| Gradle | 9.8.2 (wrapper) |
| AGP | 9.4.1 (built-in Kotlin: **don't** apply `org.jetbrains.kotlin.android`) |
| Kotlin | 2.4.21 |
| Compose BOM | 2026.09.00 |
| CameraX | 1.6.2 |
| MediaPipe tasks-vision | 1.1.1 |
| JUnit | 6.1.3 |

## 6a. pnpm 11 notes
- **Release-age policy:** pnpm refuses packages published in the last 24 h. Don't add exceptions; pin an older version instead.
- **Install scripts:** they are blocked unless listed under `allowBuilds` in `pnpm-workspace.yaml`. If `pnpm install` fails with `ERR_PNPM_IGNORED_BUILDS`, add the package with `false` (or `true` only if it really needs its script), and record it under Deviations.
- **Arguments:** pnpm 11 passes `--` through literally, so write `pnpm --filter X eval --set foo`, not `… eval -- --set foo`.

## 7. Commands
```bash
# TypeScript (repo root)
pnpm install
pnpm -r typecheck
pnpm -r test
pnpm --filter @fingerpost/protocol test      # one package
pnpm --filter @fingerpost/gateway test -- sam   # one test file by name

# Gateway locally (mock models, no key needed)
pnpm --filter @fingerpost/gateway dev        # http://localhost:8080/healthz

# Simulator on the tablet (same Wi-Fi)
pnpm --filter @fingerpost/web dev            # open http://<laptop-ip>:5173/sim/?scene=fastfood&seed=1

# Android (from apps/android)
./gradlew :core:guidance:test
./gradlew :app:assembleDebug
./gradlew :app:installDebug                   # phone connected with USB debugging
```

## 8. Code conventions
- **TS:**
  - ESM only.
  - Relative imports include the `.ts` extension (`./geometry.ts`); `rewriteRelativeImportExtensions` turns them into `.js` in builds.
  - Workspace packages resolve to source through the `source` export condition, so there's no build step before tests.
  - zod validates every boundary: env, WebSocket messages, model output.
  - No default exports except config files.
- **Naming:** files are `kebab-case.ts`; types are `PascalCase`; functions are `camelCase`. Tests live in `test/*.test.ts` next to `src/`.
- **Kotlin:**
  - Packages are `io.github.fingerpost.<module>`.
  - Pure logic (geometry, cues, state machine, PIN gate) lives in **JVM-only modules** (`core:guidance`, `core:protocol`) with no Android imports, so it runs on any JDK.
  - Android glue lives in `app`.
- **Errors spoken to users** are short and plain, and say what to do next. No stack traces, no apologies.
- **Comments** explain *why*, not what. Keep them rare.
- **Commits:** Conventional Commits (`feat(gateway): …`, `test(guidance): …`, `docs: …`), one task per commit unless the plan says otherwise.

## 9. When you're stuck
- After 2 failed attempts at the same error, stop.
  - Write a Blocker in progress.md: the task id, the exact command, the last 30 lines of output, and what you tried.
  - Then report the blocker and stop task progression under the completion gate in §3. Resume after it is resolved or the user explicitly reprioritizes the work.
- Never "fix" a failure by changing pinned versions, disabling type checks (`any`, `@ts-ignore`, `skipLibCheck` changes), or loosening a zod schema.
