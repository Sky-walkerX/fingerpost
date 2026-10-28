# Day 2 (Wed Oct 28): First Closed Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Read `AGENTS.md` first. Day 1 must be `done` in `docs/progress.md`.

**Foundation ordering correction (2026-10-28):** D2-T1's existing Kotlin protocol task is pulled forward as a Day 1 CI prerequisite, because D1-T8 already requires that module. Its original id/specification/checklist below are retained. All other Day 2 tasks and the closed-loop phase remain gated on Day 1 completion.

**User-directed phase exception (2026-10-28):** after being told Day 1 is incomplete, the user requested "Start implementing Day 2 now". Start at the first pending task with satisfied individual prerequisites. Day 1 remains incomplete, and this exception does not waive any task's tests, live/device checks or acceptance criteria.

**Subsequent priorities (2026-10-28):** the user first restored Day 1 priority, then explicitly requested “So start implementing Day 2 coding”. Resume tasks with satisfied individual prerequisites; unfinished Day 1 requirements remain open. The user resolved T4 by choosing actual speech completion over the fixed timer; correct its plan/test accordingly.

**Goal:** A voice-named button on the tablet replica is reached by a blindfolded proxy. The loop:
- **Phone:** tracks the screen and the fingertip and guides with speech, tone and haptics.
- **Gateway:** turns goal plus keyframe into layout plus target, relays speech to Voice Transcribe, and relays simulator touches.
- **Evals:** measure parse quality.

**Architecture:**
- The phone sends `fp.v1` over one WebSocket (`core:protocol`, which parses the same golden fixtures as TypeScript).
- The gateway's `SessionPipeline` is the brain for single targets. `createSessionController` wires the hub, pipeline, Voice Transcribe relay and sim registry.
- The pure-Kotlin `core:guidance` module (geometry, zones, cues, speech queue, state machine) is driven by the Android app.

**Spec:**
- `docs/guidance-spec.md` §1–§9 (authoritative for every number and transition);
- `docs/protocol.md`;
- `docs/design.md` §4.1–§4.4.

**Assets:** `docs/superpowers/plans/assets/day2/`, applied with `assets/apply.sh 2 <path>`. Skeletons throw `TODO(D2-Tn)`. Planning verified that the Day 2 starting state typechecks and compiles, that only Day 2 tests fail, and that the finished reference passes:
- gateway 68;
- evals 5;
- web 20;
- Kotlin guidance 63;
- Kotlin protocol 41.

**Lanes:** A = T1–T4 and T10; B = T5–T7; C = T8, T9 and T11. T1–T4 (pure Kotlin) need only a JDK. T10 needs the phone and tablet.

## Global Constraints
Everything in Day 1's list still applies, plus:
- **Voice Transcribe:**
  - `wss://api.meta.ai/v1/asr/realtime`, model `muse-voice-transcribe-1.0`, `ENDPOINTING`, `CUMULATIVE` partials, `PCM_16KHZ`.
  - `languageBias` takes language **names** (`English`, `Hindi`, `Spanish`); `keywords` holds at most 50 on-screen labels.
  - End of input is `{"type":"endStream"}`; events are `transcript{transcript,final}` and `speechComplete{turnId,transcript}`.
- **Audio from the phone:** PCM16LE mono 16 kHz in 20–100 ms chunks (640–3 200 bytes).
- **Sim element ids** are kebab-case forms of their labels (`pay-card` ↔ "Pay by card"). The gateway matches them with token-set ratio ≥ 0.8.
- **Kotlin:** `core:guidance` and `core:protocol` must stay free of Android imports.

## Review Focus
1. **Messages arriving faster than models answer.** A second keyframe arrives while the first is still parsing. It must be processed after the first, in order; the WebSocket route serializes per session (asset `app.ts`), so don't remove the queue. Covered by `e2e.test.ts`, which runs voice → keyframe → target over a real socket.
2. **Voice Transcribe fails or is busy.** Close code 1013, an `error` event, or a socket error each give the user exactly one spoken retry, never silence. Covered by `asr.test.ts`.
3. **A goal that matches nothing, or matches two buttons equally.** The user gets an `ask` that lists what is there, or which one. They never get a guess. Covered by `pipeline.test.ts` and `match.test.ts`.
4. **Overshoot and jitter at the target edge.** There must be no ON/OFF flicker: ON needs 6 frames to enter and 3 to leave, and "slow down" is said once. Covered by `TargetTest` and `CuePlannerTest`.
5. **Speech piling up.** Guidance cues older than 400 ms are dropped, cues are at least 700 ms apart, and SAFETY speech is never interrupted. Covered by `SpeechQueueTest`.

---

### Task D2-T1: `core:protocol` (Kotlin models + codec, contract-tested against the TS fixtures)
**Execution order:** complete this foundation before D1-T8. Add the module include to the current settings file; preserve existing app/settings corrections when applying assets.

**Files:**
- `apply.sh 2 apps/android/settings.gradle.kts apps/android/core/protocol`
- **Finished:** `Common.kt`, `ClientMessages.kt`, `ServerMessages.kt` (data classes whose `init` blocks enforce the zod limits) and `build.gradle.kts`. The build file points the tests at `../../packages/protocol/fixtures` through the system property `fixtures.dir`.
- **Skeleton:** `Codec.kt` (`parseServerMessage`, `encodeClientMessage`, `Frame.encode`, `Frame.decode`).
- **Tests:** `FixtureContractTest.kt`, `FrameTest.kt`.

**Interfaces (Produces):**
- `ProtocolJson`:
  - `Json { classDiscriminator = "type"; ignoreUnknownKeys = true; explicitNulls = false; encodeDefaults = true }`.
  - This is finished. Keep `encodeDefaults = true`, because `sampleRate` must be on the wire.
- `parseServerMessage(text): ServerParse`, one of `Ok(msg)`, `Unknown(type)` or `Invalid(error)`:
  - Not a JSON object, or a non-string `type` → `Invalid`.
  - `type` not in `SERVER_TYPES` → `Unknown`.
  - Decode failure, or an `init` `require` failing (an `IllegalArgumentException`) → `Invalid`. Never throw.
- `encodeClientMessage(msg): String`: `ProtocolJson.encodeToString(ClientMessage.serializer(), msg)`.
- `Frame.encode(header: ClientMessage, payload: ByteArray): ByteArray` and `Frame.decode(buf): DecodedFrame`. These are the same errors and order as TS `decodeFrame`.
  - Use `ByteBuffer` (big-endian by default).
  - Use a `CharsetDecoder` with `CodingErrorAction.REPORT` for strict UTF-8.

- [x] **Step 1: Copy, then confirm red.** Run `cd apps/android && ./gradlew :core:protocol:test --console=plain`. Verified 35 TODO failures/6 passes. Six added framing/type/privacy boundary tests also confirmed TODO failures before implementation.
- [x] **Step 2: Implement `Codec.kt`.** Includes common id/timestamp validation matching the TS contract and fixed error text that does not echo message contents.
- [x] **Step 3: Confirm green.** Baseline was 41 tests; all 49 now pass with 6 extra boundaries and 2 shared invalid fixtures. TS protocol 48 tests, recursive typecheck, guidance 37 tests and app build also pass. No original test weakened; model/build assets retained.
- [x] **Step 4: Commit.** Completed as a Day 1 CI prerequisite; this does not begin the other Day 2 work.
  `git add apps/android && git commit -m "feat(android): core:protocol models and codec, contract-tested on shared fixtures"`

### Task D2-T2: guidance geometry, targets and fingertip
**Files:**
- `apply.sh 2` with `apps/android/core/guidance/src/main/kotlin/io/github/fingerpost/guidance/{Geometry,Target,Fingertip}.kt` and the matching `{Geometry,Target,Fingertip}Test.kt`.
- **Finished:** `Geometry.kt` (homography by DLT, polygon tests, `targetAnchor`).
- **Skeletons:**
  - `Target.kt`: `TargetGeometry.toIso`, `zone`, `error`; `OnTargetDebouncer.update`, `reset`. The property formulas are given.
  - `Fingertip.kt`: `padPoint`, `chooseHand`, `isOffScreen`.

**Interfaces (Produces; guidance-spec §3–§4):**
- `TargetGeometry(polygonUv, aspect)`:
  - `poly` is in iso units (`x = u·aspect`).
  - `margin = max(0.15·min(bboxW,bboxH), 0.004)`.
  - `useDisc` is true when `distanceToBoundary(anchor) < margin`.
  - `discRadius = 0.3·min(w,h)`; `nearRadius = 1.5·max(w,h)`.
- `zone(pad)`:
  - `ON`: inside **and** (disc mode ? `|pad−anchor| ≤ discRadius` : `distanceToBoundary(pad) ≥ margin`).
  - `EDGE`: inside, but not ON.
  - `NEAR`: `|pad−anchor| ≤ nearRadius`.
  - `FAR`: everything else.
- `error(pad) = anchor − pad`.
- `OnTargetDebouncer(enter = 6, leave = 3)`:
  - `update(zone)` returns true only on the frame where `onTarget` changes.
  - Runs reset whenever the opposite zone appears.
- `padPoint(tip, dip) = tip − 0.25·(tip − dip)`: towards the DIP, i.e. behind the tip.
- `chooseHand(hands, w, h, targetImg)`: keep hands with presence ≥ 0.6 and the tip inside `[0,w]×[0,h]`. Pick the one nearest `targetImg`, or the first if it's `null`.
- `isOffScreen(uv)` = `uv.x ∉ [−0.15, 1.15]` or `uv.y ∉ [−0.15, 1.15]`.

- [x] **Step 1: Copy, then confirm red.** Run `./gradlew :core:guidance:test`. GeometryTest passed; 10 Target/Fingertip TODO failures confirmed. Six added boundary regressions also failed before implementation.
- [x] **Step 2: Implement.**
- [x] **Step 3: Confirm green.** Run `./gradlew :core:guidance:test`. All 63 guidance tests pass with 0 failures/errors/skips (37 existing, 20 supplied geometry/target/fingertip cases, six added boundaries).
- [x] **Step 4: Commit.**
  `git commit -m "feat(guidance): target zones, debouncer, fingertip pad point"` (after `git add`)

### Task D2-T3: cue planner, phrases and speech queue
**Files:**
- `apply.sh 2` with `…/guidance/{CuePlanner,Phrases,SpeechQueue}.kt` and `{CuePlanner,SpeechQueue}Test.kt`.
- **Finished:** `CuePlanner.kt` (overshoot logic, `orientationFor`).
- **Skeletons:**
  - `Phrases.render`;
  - `SpeechQueue.offer`, `onDone`, `poll`, `clear`.

**Interfaces (Produces):**
- `Phrases.render(cue, locale = "en"): String?`:
  - Non-`en` locales throw `IllegalArgumentException` until Day 4.
  - Prefix `"Slow down."` when `cue.slowDown` is set.
  - Directions are joined with `" and "`, then the magnitude: `" a lot"` (A_LOT), `" a little"` (A_LITTLE), or nothing (NONE/null).
  - First letter capitalized, and a period at the end.
  - Returns `null` when there's nothing to say.
- `SpeechQueue(minGuideGapMs = 700, staleGuideMs = 400)`:
  - **`offer(u)`:**
    - If something is playing and `u` outranks it, and it isn't SAFETY (GUIDE may interrupt INFO only after the minimum guide gap): drop any queued items of `u`'s priority, make `u` current, record GUIDE start time, and return `Interrupt(u)`.
    - Otherwise replace any queued item of the same priority and return `Wait`.
  - **`poll(now)`:**
    - If something is playing → `Wait`.
    - Drop GUIDE items older than 400 ms.
    - Pick the highest priority, oldest first.
    - A GUIDE item within 700 ms of the last GUIDE start → `Wait`.
    - Otherwise make it current and return `Speak`.
  - **`onDone()`** clears `current`.

- [x] **Step 1: Copy, then confirm red.** Confirmed 9 supplied phrase/queue TODO failures and six added boundary failures.
- [x] **Step 2: Implement.**
- [x] **Step 3: Confirm green.** Run `./gradlew :core:guidance:test`. All 85 cases pass with 0 failures/errors/skips; original supplied tests and finished cue planner retained unchanged.
- [x] **Step 4: Commit.**
  `git commit -m "feat(guidance): English phrases and speech queue cadence/priorities"`

### Task D2-T4: guidance state machine
**Conflict resolved by the user (2026-10-28):** follow guidance-spec §8 and wait for actual speech completion. Correct `happyPathToDone` to remain DONE after a timer tick and return to IDLE only on the matching terminal utterance completion. A completion id on `Say`/`Utterance` and `SpeechDone` prevents unrelated or stale callbacks from ending a later task. No guidance timing changes.

**Files:**
- `apply.sh 2` with `…/guidance/GuidanceStateMachine.kt` and `GuidanceStateMachineTest.kt`.
- **Skeleton:** the private helpers `go`, `handle`, `verify`, `noHandCheck` and `guidingFrame`. The types `GState`, `GEvent`, `Effect` and `Prompts`, and the private fields, are given.

**Interfaces and rules** (guidance-spec §8, the Day 2 subset; the tests pin each line):
- **Abort:** in any state other than IDLE, Abort → `[ToneOff, CloseMic]` and go to IDLE. In IDLE it does nothing.
- **IDLE** + Start → `[Say(ASK_GOAL, STATE), OpenMic]`, go to LISTENING.
- **LISTENING:**
  - GoalHeard → `[CloseMic]`, go to FRAMING.
  - Tick 8 s or more after entering:
    - first time: `[Say(ASK_GOAL_AGAIN, STATE)]` and restart the timer;
    - second time: `[CloseMic, Say(GIVE_UP_LISTENING, STATE)]`, go to IDLE.
- **FRAMING:**
  - A Frame with `quadStable` → `[SendKeyframe(LOCATE)]`, go to LOCATING.
  - At 30 s or more → `Say(FRAMING_TIPS)`, once.
- **LOCATING:**
  - TargetArrived(say) → `[Say(say, STATE), ToneOn]`. Reset the debouncer, last zone and the explore offer, then go to GUIDING.
  - TargetNotFound(say) → `[Say(say, STATE), OpenMic]`, go to LISTENING.
  - Tick 6 s or more after entering: the first time → `[SendKeyframe(LOCATE)]` and restart the timer; the second time → `[Say(LOCATE_FAILED, STATE)]`, go to FRAMING.
- **GUIDING:**
  - **A Frame without a hand:** start the no-hand timer. 1.5 s or more later (checked on Frame **and** Tick) → `Say(RAISE_FINGER, GUIDE)`, once per no-hand stretch.
  - **A Frame with a hand:**
    - Clear the no-hand timer.
    - FAR → NEAR → `Haptic(TICK)`.
    - When the debouncer turns ON → `[ToneOff, Haptic(ON_TARGET), Say(TAP, STATE), SendTargetReached]`, go to ON_TARGET. This keeps the "entered" time as this frame.
  - Tick 45 s or more after entering GUIDING → `Say(OFFER_EXPLORE, STATE)`, once.
- **ON_TARGET:**
  - When the debouncer turns OFF → `[ToneOn]`, back to GUIDING. Don't reset the GUIDING timers.
  - PressDetected(e) → `[SendTapDetected(e), SendKeyframe(VERIFY)]`, go to VERIFYING.
  - Tick 5 s or more → `Say(PRESS_NOW, GUIDE)`, once.
- **VERIFYING:**
  - VerifyArrived(r, say) always emits `Say(say, STATE)`. Then:
    - OK → DONE;
    - WRONG → `SendKeyframe(LOCATE)`, go to LOCATING;
    - NOCHANGE, first time → ON_TARGET;
    - NOCHANGE, second time → `SendKeyframe(LOCATE)`, go to LOCATING.
  - Tick 4 s or more → treat as NOCHANGE with "The screen didn't change. Press a little firmer."
- **DONE:** only `SpeechDone` matching the final STATE utterance's completion id → IDLE. Tick/Frame and unrelated completions do nothing.

- [x] **Step 1: Copy, then confirm red.** Fifteen supplied and eleven additional boundary cases fail at TODO bodies; the queue metadata case already passes.
- [x] **Step 2: Implement.** Keep it one `when (state)` block with small private helpers.
- [x] **Step 3: Confirm green.** Run `./gradlew :core:guidance:test`. All 112 guidance cases pass; protocol check and app:test/assembleDebug also succeed.
- [x] **Step 4: Commit.**
  `git commit -m "feat(guidance): guidance state machine (Day 2 subset of spec §8)"`

### Task D2-T5: gateway target resolution
**Files:**
- `apply.sh 2` with `services/gateway/src/resolve` and `services/gateway/test/match.test.ts`.
- **Skeletons:**
  - `resolve/match.ts`: `tokenSetRatio`, `goalCore`, `resolveByText`. `FILLER` is given.
  - `resolve/describe.ts`: `describePosition`, `listLabels`.
- **Depends on:** T6's files for `pipeline.test.ts`. Do T5 and T6 together, or run only `-- match` here.

**Interfaces (Produces):**
- `tokenSetRatio(a, b)`:
  - Token sets come from `normalizeLabel(...).split(' ')`.
  - 0 if either set is empty.
  - 1 if the intersection equals the smaller set (containment).
  - Otherwise `2·|∩| / (|A| + |B|)`.
- `goalCore(goal)`: the normalized goal with `FILLER` words removed.
- `resolveByText(goal, elements)`:
  - Ignore `role:'text'` elements.
  - Names are `label`, `labelLocal` and `textNorm`.
  - **Exact** normalized name equals the core: exactly 1 → `match` (score 1); more than 1 → `ambiguous`.
  - **Otherwise:** keep elements scoring ≥ 0.8 (max over names) and sort descending.
    - Others within 0.05 of the best → `ambiguous` (all of them).
    - Else → `match` with the best score.
  - Nothing left → `none`.
- `describePosition(polygon)`:
  - Uses the vertex mean.
  - Row: `top` for v < 1/3, `bottom` for v > 2/3, else `middle`. Column: `left` for u < 1/3, `right` for u > 2/3.
  - Combinations: `"top left"`, `"bottom right"`, `"middle"`, `"middle left"`, `"top"`, and so on.
- `listLabels(elements, max = 5)`: tappable labels only, as `"A"`, `"A and B"` or `"A, B and C"`.

- [x] **Step 1: Copy, then confirm red.** Run `pnpm --filter @fingerpost/gateway test match`.
- [x] **Step 2: Implement.**
- [x] **Step 3: Confirm green.** Run `pnpm --filter @fingerpost/gateway test match`. All seven supplied plus ten boundary cases pass; full gateway suite 160/160 and recursive typecheck pass.
- [x] **Step 4: Commit.**
  `git commit -m "feat(gateway): deterministic goal→element resolution and position words"`

### Task D2-T6: session pipeline (the Day 2 brain)
**Files:**
- `apply.sh 2` with:
  - `services/gateway/src/session/{pipeline,types}.ts`;
  - `services/gateway/src/quota/{cost,ports}.ts`;
  - `services/gateway/src/errors/spoken.ts`;
  - `services/gateway/test/pipeline.test.ts`.
- **Finished:** `types.ts` (Tier, SessionClaims, StartResult, QuotaPort), `cost.ts`, `ports.ts` (the memory stores) and `spoken.ts`.
- **Skeleton:** `pipeline.ts`: `layoutFingerprint`, `labelJaccard`, `simMatches`, and the `SessionPipeline` methods.

**Interfaces (Produces):**
- `layoutFingerprint(elements)`: `'sh64:'` + the first 16 hex chars of sha256 of the sorted (`textNorm ?? label.toLowerCase()`) values joined with `'|'`.
- `labelJaccard(a, b)`: Jaccard over those same keys; 1 if both are empty.
- `simMatches(simId, el) = tokenSetRatio(simId.replaceAll('-', ' '), el.label) ≥ 0.8`.
- `new SessionPipeline({ models, send, now?, onUsage?, beforeTask? })`:
  - **`onGoal(text)`:** store the goal, reset "task charged", send `goal.ack{goal, intent:'guide'}`.
  - **`onSimTouch(elementId)`:** remember it for the next verify.
  - **`onKeyframe(header, jpeg)`:**
    1. **Gate:** if the purpose is `locate`, a goal is set, it isn't charged yet, and `beforeTask` exists, await it. If it isn't ok, send `error{code, ...SPOKEN_ERRORS[code]}` and return.
    2. **Charge:** mark the task charged.
    3. **Parse:** `models.parseScreen(...)`, then `onUsage({kind:'spark', …})`, then send `layout{fingerprint, source:'model', ...parsed}`.
    4. **Verify:** if the purpose is `verify`:
       - a sim touch that doesn't `simMatches` the target → `wrong` + `actualElementId`, say `That pressed something else. Let's find ${label} again.`;
       - no previous layout, or `labelJaccard < 0.7`, or any sim touch → `ok`, say `Done.`;
       - otherwise → `nochange`, say `The screen didn't change. Press a little firmer.`
       - It replies with `re = keyframe id`, then clears the sim touch.
    5. **Locate:** resolve the goal.
       - `none` → `ask{question: "I can't find that. I see ${listLabels} … What do you want to press?", options: up to 8 tappable labels}`. If nothing is tappable, use `'nothing I can read'`.
       - `ambiguous` → `ask{question: "I see ${listLabels(candidates)}. Which one?"}`.
       - `match`:
         - Compute the pixel box from the element polygon × `imageSize`.
         - Call `segmentByBox`, then `onUsage({kind:'sam_image', images:1})`.
         - polygon = SAM's polygon ?? the element's.
         - Send `target{elementId, polygon, confidence: min(el, sam ?? el), say: "Found ${label}, ${describePosition(polygon)}."}`.

- [x] **Step 1: Copy, then confirm red.** Run `pnpm --filter @fingerpost/gateway test pipeline`.
- [x] **Step 2: Implement.**
- [x] **Step 3: Confirm green.** All 20 pipeline and 17 match cases pass; recursive typecheck/build and full 242-case TS suite pass. Run `pnpm --filter @fingerpost/gateway test pipeline match`.
- [x] **Step 4: Commit.**
  `git commit -m "feat(gateway): session pipeline: locate, ask, target, verify"`

### Task D2-T7: controller, Voice Transcribe relay, sim relay, Day 2 app
**Status (2026-10-28):** coding/local verification complete, required live ASR acceptance and redeployment blocked. No Meta key is configured and ADR-0003 is still proposed. Preserve this task as blocked until Steps 4/5 pass.

**Files:**
- `apply.sh 2` with:
  - `services/gateway/package.json` (adds `ws`, and the `exports` for `./eval-api`);
  - `services/gateway/src/{config,app,eval-api}.ts` and `services/gateway/src/util` (`safeEqual`, a constant-time token compare);
  - `services/gateway/src/session/controller.ts`, `src/asr`, `src/sim`, `src/models/mock/mock-asr.ts`;
  - `services/gateway/test/{asr,e2e}.test.ts`.
- Then run `pnpm install`.
- **Skeletons:**
  - `controller.ts` (`createSessionController`);
  - `asr/relay.ts` (`handshake`, `openAsrRelay`);
  - `sim/registry.ts` (`SimRegistry.subscribe` and `publish`; the `SimEventBody` schema is given).
- **Finished:** `app.ts` (per-session ordered queue; the sim route is open in mock mode, and in live mode exists **only** when `SIM_TOKEN` is set, compared with `safeEqual`), `config.ts` (+ `SIM_TOKEN`), `mock-asr.ts`, `eval-api.ts`, `util/safe-equal.ts`.

**Interfaces (Produces):**
- **`handshake(o)`:** exactly the object in `asr.test.ts`. `languageBias` is `o.locales` mapped through `LANGUAGE_NAMES`; `keywords` is `o.keywords.slice(0, 50)`.
- **`openAsrRelay(o, sink)`:**
  - **On open:** send the handshake, then flush buffered audio (at most 5 s = 160 000 bytes; drop anything beyond that). Send `endStream` if `end()` was already called.
  - **Events:**
    - `transcript` with a string `transcript` → `sink.partial`.
    - The first `speechComplete` → `sink.final`, then close with 1000.
    - `error` → `sink.error(message)`, then close.
    - A socket error, or a close before finishing → `sink.error`, once; close code 1013 → `'asr busy'`.
  - **Returns** `{ push, end, close }`. `push` is ignored after `end` or after finishing.
- **`SimRegistry`:** `subscribe(runId, listener) → unsubscribe`; `publish(event) → delivered count`.
- **`createSessionController({ send, models, asr, sims, now?, claims?, quota? })` → `{ hub, dispose }`:**
  - **hello:** `pipeline.setLocale`, and subscribe to `caps.simRunId`. On each event, send `sim.touch{…}` and call `pipeline.onSimTouch`.
  - **goal / answer:** `pipeline.onGoal(text)`.
  - **audio:**
    - Lazily open the relay with `{locales: [hub.locale], keywords}`.
    - On a partial → send `transcript{final:false}`.
    - On the final → send `transcript{final:true}` and call `pipeline.onGoal`.
    - On an error → send `error{model_unavailable, retryable:true, say:"I didn't catch that. Please say it again."}`.
    - Push the payload.
  - **audio.end:** `relay.end()`.
  - **keyframe:** `pipeline.onKeyframe`.
  - **abort:** close the relay.
  - **Day 3 hooks:** when `quota` is given, `onUsage` → `quota.recordUsage` (fire-and-forget). When `claims` is also given, `beforeTask` → `quota.startTask(uid, tier)`. ASR seconds are `audioBytes / 32 000`, recorded on the final.
  - **`dispose`:** close the relay and unsubscribe.

- [x] **Step 1: Copy and install, then confirm red.** Run `pnpm --filter @fingerpost/gateway test asr e2e`.
- [x] **Step 2: Implement** `registry.ts`, `relay.ts` and `controller.ts`.
- [x] **Step 3: Confirm green.** Run `pnpm --filter @fingerpost/gateway test && pnpm --filter @fingerpost/gateway typecheck`. All 205 gateway cases and recursive typecheck/build pass; source/compiled localhost mock exchanges pass.
- [ ] **Step 4: Live check** (needs the D1 key). Run `set -a; source .env; set +a; MODEL_MODE=live pnpm --filter @fingerpost/gateway dev` and connect any WS client.
  - Voice Transcribe's documented handshake has nine fields. If the server rejects `languageBias` or `keywords`, remove them from `handshake()`, update `asr.test.ts` to match, and record a Deviation.
- [ ] **Step 5: Redeploy** to the ADR-0003 region with `infra/deploy-gateway.sh fingerpost-dev <region>`. To use the sim against the live gateway, first create a `sim-token` secret (`openssl rand -hex 16`), add `SIM_TOKEN=sim-token:latest` to `--set-secrets`, and open the sim with `&token=<value>`. Without it, live mode has no sim route at all.
- [x] **Step 6: Commit coding work.** Live Steps 4/5 remain blocked; this commit does not complete the task.
  `git commit -m "feat(gateway): session controller, Voice Transcribe relay, sim touch relay"`

### Task D2-T8: eval harness v1 (`evals/`)
**Files:**
- `apply.sh 2 evals && pnpm install`.
- **Finished:** `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/dataset.ts` (the label file schema), `src/run.ts` (CLI), `datasets/mock-panel/**`, `test/metrics.test.ts`.
- **Skeletons:**
  - `src/metrics.ts`: `iou`, `boxOfPolygon`, `matchElements`, `percentile`, `centreInBox`, `costUsd`, `summarize`. `renderReport` and `SENSITIVE` are given.
  - `src/evaluate.ts`: `evaluateItem`.

**Interfaces (Produces):**
- `iou(a, b)` on normalized boxes; 0 when the union ≤ 0.
- `matchElements(pred, gt, minIou = 0.5, minLabel = 0.8)`:
  - Greedy one-to-one matching over candidate pairs that meet both thresholds, sorted by IoU descending.
  - Returns `{ tp, fp, fn, pairs }`.
- `percentile(xs, p)`: nearest rank, `ceil(p/100·n) − 1` (clamped); NaN when empty.
- `costUsd(in, out, sam) = (in·1.25 + out·4.25)/1e6 + sam·0.0025`.
- `summarize(results)`: the `Summary` fields; NaN ratios when the denominator is 0.
- `evaluateItem(models, dir, item, readImage?)`:
  - Calls `parseScreen` (locale en).
  - Each goal: run `resolveByText`. On a match, call `segmentByBox` on the element's pixel box. A hit means the polygon centre is inside the ground-truth box of the goal's label.
  - `screenTypeOk`, `gtSensitive` and `predSensitive` use `SENSITIVE`.

- [ ] **Step 1: Confirm red, implement, confirm green.** Run `pnpm --filter @fingerpost/evals test`. Expected: 5 pass.
- [ ] **Step 2: Mock run.** Run `pnpm --filter @fingerpost/evals eval --set mock-panel --mode mock --out ../docs/evals/report-mock.md`. Expected: target hit rate 50.0%.
- [ ] **Step 3 (lane C, human + agent): label the real photos.**
  - Create `evals/datasets/day1/labels.json` for the D1 photos in the `LabelFile` format.
  - Elements: every control's box (normalized), label text exactly as printed, role and screenType, plus 1–3 `goals` per image.
  - Use the D2-T11 labeling page if it's ready. Aim for 20 images today and 60 by Day 3.
- [ ] **Step 4: First live eval.** Run `set -a; source ../.env; set +a; pnpm --filter @fingerpost/evals eval --set day1 --mode live --out ../docs/evals/report-day2-baseline.md`. Commit the report.
- [ ] **Step 5: Commit.**
  `git commit -m "feat(evals): metrics, evaluate, CLI; baseline report"`

### Task D2-T9: sim scenes 2 and 4, and relaying touches to the gateway
**Files:**
- `apply.sh 2` with `apps/web/src/sim/{net,main}.ts`, `apps/web/src/sim/scenes/{ticket,cooktop}.ts` and `apps/web/test/scenes2.test.ts`.
- **Skeleton:** `net.ts` (`postTouch`).
- **Finished:** the scenes, and `main.ts` (`?gw=` and `?token=` parameters).

**Interface:**
- `postTouch(ev, {gatewayUrl, token?, fetchImpl?, timeoutMs = 2000})`:
  - POSTs `{runId, screenId, x, y, u, v, elementId, ts}`. `pointerId` is omitted.
  - Sends the `x-sim-token` header only when a token is given.
  - Uses `AbortSignal.timeout`.
  - Returns `res.ok`, or `false` on any throw.

- [ ] **Step 1: Copy, confirm red, implement, confirm green.** Run `pnpm --filter @fingerpost/web test`. Expected: 20 pass.
- [ ] **Step 2: Check on the tablet.** Open `http://<laptop-ip>:5173/sim/?scene=ticket&seed=2&run=run-demo&gw=http://<laptop-ip>:8080`, with the gateway running locally in mock mode.
  - Tap three buttons.
  - In the gateway logs (`LOG_LEVEL=debug`), you see the POSTs; `delivered: 0` until the app connects with `caps.simRunId = run-demo`.
- [ ] **Step 3: Commit.**
  `git commit -m "feat(web): ticket machine and cooktop scenes, touch relay to the gateway"`

### Task D2-T10a (device): screen tracker and local quad estimate
**Files:** create the following in `app/src/main/kotlin/io/github/fingerpost/vision/`. All are your code, and none have JVM unit tests: they depend on OpenCV, so test them on the device. Also apply the D2 `app/build.gradle.kts` and manifest: `apply.sh 2 apps/android/app/build.gradle.kts apps/android/app/src/main/AndroidManifest.xml --force`.
- `QuadEstimator.kt`
- `ScreenTracker.kt`
- `Gray.kt` (Bitmap → grayscale `Mat` helper)

**Requirements:**
- **OpenCV setup:** call `OpenCVLoader.initLocal()` once at app start. If it returns false, say "Camera tracking couldn't start." and log.
- **QuadEstimator** (guidance-spec §2.0), at 10 Hz on a 640×360 downscale:
  - **Candidate 1, contours:**
    - `Imgproc.Canny(gray, edges, 50.0, 150.0)`
    - `Imgproc.findContours(edges, contours, Mat(), Imgproc.RETR_EXTERNAL, Imgproc.CHAIN_APPROX_SIMPLE)`
    - For each contour: `approxPolyDP(MatOfPoint2f(*c.toArray()), out, 0.02 * Imgproc.arcLength(c2f, true), true)`.
    - Keep convex 4-gons covering 8–90% of the frame.
  - **Candidate 2, content bounds:** the convex hull (`Imgproc.convexHull`) of the OCR boxes (Day 3; skip on Day 2) plus bright regions (Otsu on the HSV V channel), then `Imgproc.minAreaRect` → 4 corners, expanded by 6%.
  - **Choice:** the largest-area valid candidate. Corners are ordered TL, TR, BR, BL by sorting on y, then x within each row.
  - **Stability:** feed the result to `QuadStability` (Day 3 class) or to a simple 10-frame stability check. If nothing is stable within 4 s, send one full frame anyway (the server returns `screenQuad`).
- **ScreenTracker** (guidance-spec §2), on every analysis frame:
  - Features inside the quad, minus the hand bounding box dilated by 15%: `Imgproc.goodFeaturesToTrack(gray, pts, 200, 0.01, 8.0, mask)`. Re-detect when fewer than 40 remain.
  - Track with `Video.calcOpticalFlowPyrLK(prev, gray, prevPts, nextPts, status, err, Size(21.0, 21.0), 3)`.
  - Then `Calib3d.findHomography(prevGood, nextGood, Calib3d.RANSAC, 3.0, inliers)`.
  - **Valid** with at least 12 inliers. Map the quad corners through H with `Core.perspectiveTransform`.
  - **States:** `TRACKING`; `DEGRADED` after 5 or more frames with < 12 inliers; `LOST` after 1 s or more in DEGRADED.
  - `reanchor(serverQuad)` replaces the quad when a `layout.screenQuad` arrives.
  - **Output:** `currentQuad` (image px) and `imageToScreen: Homography?`, built from `Homography.imageToScreen(quad)` in `core:guidance`.

- [ ] **Step 1: Implement**, with a debug overlay that draws the quad (in green while TRACKING).
- [ ] **Step 2: Check on the device.** Point at the tablet showing the cooktop scene:
  - the quad locks within 2 s;
  - it follows a slow pan without jumping;
  - your hand over the screen doesn't drag it.
  - Note the results in progress.md.
- [ ] **Step 3: Commit.**
  `git commit -m "feat(android): local screen quad estimate and KLT homography tracker"`

### Task D2-T10b (device): session client and mic streaming
**Files:** create `app/src/main/kotlin/io/github/fingerpost/session/{SessionClient,MicStreamer,Keyframer}.kt`.

**Requirements:**
- **`SessionClient(url = BuildConfig.GATEWAY_URL + "/v1/session")`:**
  - OkHttp with `pingInterval(15, TimeUnit.SECONDS)`.
  - Open with `client.newWebSocket(Request.Builder().url(url).header("Fp-Protocol", "fp.v1").build(), listener)`.
  - Send text with `ws.send(encodeClientMessage(msg))` and binary with `ws.send(Frame.encode(header, payload).toByteString())` (`import okio.ByteString.Companion.toByteString`).
  - **Incoming:** each text frame goes through `parseServerMessage`. `Ok` messages go into a `SharedFlow<ServerMessage>`; `Unknown` is ignored; `Invalid` is logged (type only).
  - **Reconnect:** exponential backoff of 0.5 s → 8 s with jitter, then re-send `hello`.
  - **ids:** `UUID.randomUUID().toString()` is fine for message ids (the schema needs 1–64 chars). `ts` is `System.currentTimeMillis()`.
- **`MicStreamer`:**
  - `AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, max(minBuf, 3200))`.
  - Read 640-byte chunks (20 ms) and send `AudioHeader(seq++)` frames; `stop()` sends `AudioEnd`.
  - Request `RECORD_AUDIO` at runtime before the first use.
  - **The mic never runs while PIN mode is active** (Day 3–4).
- **`Keyframer.encode(upright: Bitmap, quad: List<Vec2>?, kind): ByteArray`:**
  - `full`: downscale to 1024 px wide, JPEG quality 80.
  - `screen`: rectify the quad to a 1024-wide crop with `Imgproc.getPerspectiveTransform` and `Imgproc.warpPerspective`, then JPEG 80.
  - Must be ≤ 400 KB; if it's larger, re-encode at quality 65.
  - **Day 2:** `full` frames go to `localhost` / dev only. Face covering arrives on Day 3, before any external tester session.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Check on the device**, against the laptop gateway in mock mode, with `fingerpost.gatewayUrl=ws://<laptop-ip>:8080` in `~/.gradle/gradle.properties`:
  - hello gets `ready`;
  - speaking "start" gets a `transcript` and then `goal.ack`;
  - a keyframe gets `layout` and then `target` (mock e5).
- [ ] **Step 3: Commit.**
  `git commit -m "feat(android): fp.v1 session client, mic streaming, keyframe encoder"`

### Task D2-T10c (device): guidance engine wiring (speech, tone, haptics)
**Files:** create `app/src/main/kotlin/io/github/fingerpost/engine/{GuidanceEngine,TtsSpeaker,Haptics}.kt`. Modify `SessionScreen.kt`.

**Requirements:**
- **`GuidanceEngine`** owns `GuidanceStateMachine`, `CuePlanner`, `SpeechQueue`, `OneEuroFilter` ×2, `OnTargetDebouncer` and the current `TargetGeometry`.
- **Every analysis frame:**
  1. tracker → quad and H;
  2. HandTracker → `chooseHand`;
  3. `padPoint` → H → uv;
  4. filter the u and v components;
  5. `target.zone(target.toIso(uv))`;
  6. `machine.handle(GEvent.Frame(...))`;
  7. while GUIDING: `planner.plan(target.error(iso), orientationFor(pitch), now)` → `Phrases.render` → `speech.offer(Utterance(text, GUIDE, now))`, plus `tone.setFrequency(toneFrequencyHz(|e|))` and `tone.setPan(tonePan(e.x))`.
- **A 100 ms ticker** sends `GEvent.Tick` and polls `speech.poll(now)`.
- **Server messages → events:**
  - `target` → `TargetGeometry(polygon, aspect = quadWidthPx / quadHeightPx)`, then `TargetArrived(say)`.
  - `ask` (Day 2) → `TargetNotFound(question)`.
  - `verify` → `VerifyArrived`.
  - `transcript{final}` → `GoalHeard`.
- **Effects → actions:**
  - `Say` → `speech.offer`.
  - `OpenMic`/`CloseMic` → `MicStreamer`.
  - `SendKeyframe` → `Keyframer` + `SessionClient`.
  - `ToneOn`/`ToneOff` → `ToneSynth`.
  - `Haptic` → `Haptics`.
  - `SendTapDetected` and `SendTargetReached` → `ClientEvent`.
- **`TtsSpeaker`:**
  - `TextToSpeech(context) { … }` with `setAudioAttributes(USAGE_ASSISTANCE_ACCESSIBILITY)` and `setLanguage(Locale.forLanguageTag("en-IN"))`.
  - `Speak` → `speak(text, QUEUE_FLUSH, null, id)`; `Interrupt` → `stop()` then speak.
  - Preserve `Say.completionId` in `Utterance` and correlate it to the Android TTS utterance id. `UtteranceProgressListener.onDone` → `speech.onDone()` and, for that matching completed utterance, `GEvent.SpeechDone(now, completionId)`. Ignore callbacks from canceled/replaced utterances; do not synthesize completion from a timer.
- **`Haptics`:**
  - `TICK` → `VibrationEffect.createPredefined(EFFECT_TICK)`.
  - `ON_TARGET` → `EFFECT_HEAVY_CLICK` twice, 120 ms apart.
  - `LOST` → `createOneShot(300, DEFAULT_AMPLITUDE)`.
  - Use `VibratorManager` on API 31+ and `Vibrator` on 29–30.
- **Camera pitch:** from `Sensor.TYPE_GRAVITY`, as `pitchBelowHorizonDeg = toDegrees(atan2(gz, gy))` mapped to [0, 90]. Check the value: phone flat facing down ≈ 90; upright ≈ 0.
- **Press evidence (Day 2):** only the sim touch (`sim.touch` → `PressDetected(SIM)`). Screen-change and dwell come on Day 3.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Check on the device** against the mock gateway. Run the whole loop on the tablet cooktop scene: start → say "boil" → frame → target → guided → ON → tap → verify → "Done."
- [ ] **Step 3: Commit.**
  `git commit -m "feat(android): guidance engine wires state machine, cues, speech, tone, haptics"`

### Task D2-T10d (exit check): blindfolded proxy trials
- [ ] **Run the trials.** Live gateway, tablet fast-food scene. A blindfolded teammate (a **proxy**) does 10 trials, each with a different target named by voice.
  - Record time-to-target (from the "Found …" speech to ON) and success in `docs/evals/daily.md`, with sim run ids.
  - **Pass:** at least 5 of 10, each under 20 s.
- [ ] **Commit.** `git commit -m "docs(evals): day 2 proxy trials"`

### Task D2-T11 (lane C): labeling page and booking
- [ ] **Labeling page.** Create `apps/web/label/index.html` and `apps/web/src/label/main.ts`:
  - load a local JPEG (file input);
  - drag to draw boxes;
  - for each box, enter the label, a role (select from the protocol roles) and screenType;
  - add goals;
  - "Copy JSON" outputs one `LabelFile` item, with boxes normalized to the image.
  - Add it to `vite.config.ts` as an input (`label: 'label/index.html'`).
  - No tests needed; it's an internal tool. Record it in progress.md.
- [ ] **Book testers.** Book sessions for Days 4–6 in `docs/testers.md`, and write `docs/consent-form.md` translations if they're missing.
- [ ] **Commit.** `git commit -m "feat(web): labeling tool for eval datasets"`

---

## Day 2 exit check (23:00 IST)
- D2-T10d passed (≥ 5/10 under 20 s, proxy).
- The baseline eval report is committed.
- CI is green.
- Misses go to the Day 3 stand-up. The noon gate (D3-T0) uses the same rig.
