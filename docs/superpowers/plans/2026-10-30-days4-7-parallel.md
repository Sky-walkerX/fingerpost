# Days 4–7 (Oct 30 – Nov 4): Three-Lane Parallel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Read `AGENTS.md` first, then the **Working agreement** below. Where this plan and AGENTS.md §3 disagree on ordering, this plan wins: a blocked task blocks only the tasks that list it under "Needs".

**Goal:** Ship v1.0.0-beta by Nov 2. That means the multi-step agent with a confirm gate, local PIN mode, private mode, explore, kiosk memory, offline basic and a signed APK. Three people work in parallel with near-zero waiting on each other.

**Architecture:** The three lanes own disjoint directories and meet only at frozen contracts:
- **Protocol:** `packages/protocol` plus the Kotlin `core:protocol`.
- **Flow scripts:** `packages/protocol/fixtures/flows/*.json`.
- **Sim labels:** `labelsFor`.

Every lane codes against **mocks of the other two**:
- A uses the gateway in `MODEL_MODE=mock` with scripted layouts.
- B uses a scripted virtual device in Vitest.
- C uses the sim and the eval harness in mock mode.

Real integration happens once a day, at 23:00.

**Tech Stack:** As in AGENTS.md §6 (pinned). New this plan:
- Android `SpeechRecognizer` (on-device, offline basic);
- DataStore Preferences;
- Firebase Crashlytics and Remote Config (BoM already added on Day 3);
- Modal + vLLM (Python, `services/private-models` only);
- k6 is **not** added: the load test is a Node script using `ws`.

**Spec:**
- `docs/design.md` §3.2–3.6, §4.2–4.9, §5, §7 (Days 4–7), §8;
- `docs/guidance-spec.md` §5, §8–§12;
- `docs/protocol.md`.

**Assumption:** Day 3 is done:
- the gate has passed or the cut is applied;
- the PIN gate, OCR, framing, attestation, quota and auth-on deploy have landed.

**User-directed local continuation (2026-10-30):** the user has no GCP account and requested local testing/future coding until cloud access returns. Independent mock-first work may proceed without claiming the Day 3 gate or deploy complete. All cloud/device/live acceptance and release gates remain open; [revalidation tracking](../../evals/cloud-revalidation.md) records the deferred checks.

If the gate failed, apply the cut column in **Cut lines** before starting.

## Working agreement (all lanes)

**1. Ownership.** Only the owning lane edits a path. Anything else goes through a PR that the owner reviews within 2 h.
| Lane | Person | Owns |
|---|---|---|
| **A: device** | Android dev | `apps/android/**` except `core:protocol` |
| **B: brain** | Gateway/AI dev | `services/**`, `packages/protocol/**`, `apps/android/core/protocol/**`, `infra/**`, `.github/**` |
| **C: quality + story** | Web/evals/video | `apps/web/**`, `evals/**`, `docs/evals/**`, `docs/site/**`, README, video |

**2. Contracts first.** Each day starts with a contract task (≤1 h), owned by B. It freezes any protocol or flow-script change for that day. After it merges, lanes A and C never wait on B's implementation, only on the contract.

**3. Commits:**
- small, one logical change each, Conventional Commits, one-line subject;
- no claim commits: claim in the 10:00 stand-up and write your name on the board in the task's first real commit;
- no AI attribution trailers.

**4. Integration (23:00 daily).** Lane A builds the APK from `main`, then 10 proxy trials on the tablet sim. Results go in `docs/evals/daily.md`, with a one-line note per lane in `docs/progress.md`.

**5. 🔑 tasks** need the Meta key, Modal credits or GCP/Firebase credentials. Every 🔑 task has a **mock-first** step that can merge without the key. Its live step is ticked later by whoever holds the credential. A missing key never blocks a non-🔑 task.

**6. Definition of done:**
- AGENTS.md §4;
- the task's listed verification passes;
- for device tasks, the listed on-device check is recorded in `docs/evals/daily.md` with a generic device label.

## Global Constraints
- **Agent policy:**
  - `guide_to` on role `pay | confirm | submit` is refused unless `confirm_with_user` returned yes for that element in this session;
  - step budget 20 steps or 5 min;
  - loop = the same layout fingerprint 3 times → `ask` "Should I go back?".
- **Device safety (guidance-spec §11):** the device independently refuses to guide to `pay | confirm | submit` without an accepted `confirm` this session.
- **State timeouts (guidance-spec §8):**
  - ASK: 10 s → repeat the question once;
  - CONFIRM: 15 s → cancel with "Payment not confirmed.";
  - LOCATING: 6 s → retry once;
  - VERIFYING: 4 s → nochange.
- **PIN mode (guidance-spec §10):**
  - entry stops uploads and the mic and sends `event{pinModeEntered}`;
  - the audio route must be wired, A2DP or BLE, otherwise say "Connect earphones for PIN help";
  - digit under finger: debounce 150 ms, INFO priority, earphones only, never logged or stored;
  - exit: fewer than 5 digit tokens for 2 s.
- **Explore:** the summary is ≤3 sentences, by region, ending "Say more for details."; touch-explore runs locally.
- **Kiosk memory:**
  - SimHash 64-bit of normalized stable OCR tokens + aspect bucket + grid signature; hit = Hamming ≤3 and `trusted`;
  - trusted = agreed by ≥2 distinct attested installs, storing ≤5 salted SHA-256 key-id hashes;
  - no images, uids, prices, names or numbers in `kiosk_layouts`.
- **Latency targets:** first parse p50 ≤2.5 s; re-target on a known layout ≤1.2 s; memory hit ≤0.8 s.
- **Model calls:** per-call timeout 5 s, no SDK retries. The router owns retry and fallback: Spark 1.3 → Spark 1.2 → Glimmer (if warm) → offline.
- **Languages:** `en`, `hi`, `es` for every spoken string. Spanish may slip past Nov 2 (design §1); Hindi may not.
- **Release gates (design §5.6):**
  - Hard: PIN/payment recall ≥98% on ≥150 examples; 0 wrong pay taps.
  - Soft: single-target ≥90% on sim; median time-to-target ≤10 s; first parse p50 ≤2.5 s; crash-free ≥99% over a 30-min soak.
- **Never:**
  - a PIN frame uploaded;
  - a `-contributor` model id;
  - content in logs;
  - a guess at an icon with confidence below 0.75 without saying "I think".

## Review Focus
1. **A spoken "yes" to a different question unlocks pay.** The confirm acceptance must be bound to the `confirm.id` and its element. Tests: `policy.test.ts › yes to an earlier confirm does not unlock a new pay target` (B4-2) and `SafetyPolicyTest.acceptanceIsPerConfirmId` (A4-2).
2. **A PIN pad appears mid-agent-flow** (the pay screen leads straight to the keypad). The device must enter PIN mode before the next upload, even while VERIFYING. Test: `TaskStateMachineTest.pinGateDuringVerifyingBlocksUpload` (A4-1).
3. **The user says "go back" or presses Back on the kiosk.** The agent must re-plan from the new layout, not repeat the stale step. Test: `agent-loop.test.ts › recovers when the screen goes back` (B4-2).
4. **A kiosk memory hit for a look-alike screen.** It must never be trusted without fresh OCR agreement on the target label. Test: `memory.test.ts › near-duplicate fingerprint still requires OCR agreement` (B5-2).
5. **Offline mode receives an icon-only goal.** It must say that icons need the cloud, not guide to a random text match. Test: `OfflineResolverTest.iconGoalSaysCloudNeeded` (A6-1).

---

## Contracts (frozen by B at the start of each day)

**Flow scripts:** `packages/protocol/fixtures/flows/<name>.json`. These are the shared truth between the device and the agent:
```jsonc
{ "name": "medium-cola", "scene": "fastfood", "seed": 1,
  "steps": [ { "from": "client"|"server", "msg": { /* fp.v1 message, ids/ts may be "*" */ },
               "screen"?: "home"|"menu"|… /* sim screen whose labelsFor() the mock parse returns */ } ] }
```
- **B** replays the client side against the gateway and asserts the server side (`test/flows.test.ts`).
- **A** replays the server side into the Kotlin `TaskStateMachine` and asserts the client side (`FlowReplayTest`).
- **C** validates each flow against the sim's `next` graph (`apps/web/test/flows.test.ts`).

**Device-side task turn (decided here, no protocol change):**
- In `task` intent, `verify.ok` does not end the session. The device goes to `AWAIT_NEXT` and waits for `target | ask | confirm | finish | say`.
- After 6 s with nothing, it sends `keyframe{purpose:"locate"}` once. After another 6 s it says "I lost track. What do you want to do?" and goes to LISTENING.
- `finish{result:"done"}` → DONE. After `answer` or `confirm.reply{accepted:true}`, the device sends `keyframe{purpose:"locate"}`.

**Explore turn:**
- `goal.ack{intent:"explore"}` → the device sends `keyframe{purpose:"explore"}`.
- The server replies `say{priority:"info"}` with the summary and keeps a region cursor.
- A later goal of "more" or "más" (or the Hindi "और") → the next region's `say`.

---

## Day 4 — Fri Oct 30: agent, safety modes, private mode

**Exit:**
- "Order a medium cola and pay" completes on the tablet sim, with a spoken amount confirm and then PIN mode (digit under finger in earphones).
- Private mode returns a usable layout (mock-first; 🔑 Modal live).

### B4-0 (B, 09:00–10:00): contract + review hardening
**Files:**
- Create: `packages/protocol/fixtures/flows/{medium-cola,guide-start,explore-summary,go-back}.json`, `packages/protocol/test/flows.test.ts`.
- Modify: `services/gateway/src/app.ts`, `services/gateway/src/models/meta-client.ts`, `services/gateway/src/asr/relay.ts`, `services/gateway/src/session/pipeline.ts`.

- [x] **Step 1: Write the flows.** Four synthetic scripts cover guide, task/confirm/PIN, explore and Back recovery. The final payment verification frame is still the safe pay panel before the PIN-entry event; no PIN image/audio is included. Future replay/simulator timing acceptance remains separate.
- [x] **Step 2: Write `flows.test.ts`.** Nine TS checks validate all messages, screen markers, current-confirm acceptance, PIN upload exclusion, Back recovery and explore shape. Four additional Kotlin cases validate the same messages. All 57 TS/53 Kotlin protocol cases and recursive typecheck pass. No wire schema/model change.
- [x] **Step 3: Write failing gateway tests:** Initial 11 failures/one pass confirmed; 17 new cases cover cancellation, startup/backlog/quota races and SDK/ASR bounds. See [local evidence](../../evals/day4-gateway-hardening.md).
  - `app.test.ts › abort is handled while a keyframe is in flight`: a mock `parseScreen` that never resolves, then `abort` → `finish{aborted}` within 50 ms, and no `target` afterwards.
  - `pipeline.test.ts › locate before any goal sends nothing billable`: no `parseScreen` call.
  - `asr-boundaries.test.ts › connect timeout errors after 5 s`: fake timers.
- [x] **Step 4: Implement:**
  - In `app.ts`, handle `abort` outside the per-session queue. Give `SessionPipeline` an `AbortController` per task and drop results from a cancelled task.
  - Set `timeout: 5_000, maxRetries: 0` in `createMetaClient`.
  - Use `new WebSocket(url, { handshakeTimeout: 5_000 })` in the relay.
  - In `onKeyframe`, return early when `purpose === 'locate' && !this.goal`.
- [x] **Step 5: Verify:** `pnpm -r test` → 389 passed; recursive typechecks/builds, 31 tooling cases, Android compatibility and compiled loopback smoke pass. No live/cloud/device acceptance is claimed.
- [x] **Step 6: Commit** (two commits):
  - `test(protocol): day 4 flow scripts`
  - `fix(gateway): abort bypasses queue, 5 s model timeouts, ASR connect timeout`

### Lane A — device

#### A4-0: tracking budget under throttling (guidance-spec §12)
**Files:** Modify `vision/TrackingOptions.kt`, `vision/HandTracker.kt`.
- [ ] **Change the defaults:** `maxHands = 1`.
- [ ] **Add `ThrottlePolicy`** to `core:guidance` (pure):
  - `fun stride(thermalStatus: Int, recentInferenceMs: Long): Int`;
  - returns 1 when status <2 and inference <40 ms; 2 when status ≥2 **or** inference ≥40 ms; 3 when status ≥4;
  - `HandTracker` submits every `stride`th frame.
- [ ] **Test `ThrottlePolicyTest`:** (0,20)→1, (2,20)→2, (0,45)→2, (4,20)→3.
- [ ] **On-device check:** record fps and inference ms for one hand on the test phone at thermal status ≤1 in `docs/evals/daily.md`.
- [ ] **Commit:** `perf(android): single-hand tracking and thermal frame stride`

#### A4-1: task-mode state machine (ASK, CONFIRM, AWAIT_NEXT, PIN_MODE)
**Files:**
- Modify: `core/guidance/.../GuidanceStateMachine.kt`.
- Create: `core/guidance/.../TaskTurns.kt`, `core/guidance/src/test/.../TaskStateMachineTest.kt`, `core/guidance/src/test/.../FlowReplayTest.kt`.
- Copy the flows into `core/guidance/src/test/resources/flows/` with a Gradle `Copy` task from `packages/protocol/fixtures/flows`.

**Interfaces:**
- **New `GState` values:** `ASK, CONFIRM, AWAIT_NEXT, PIN_MODE`.
- **New events:**
  - `GEvent.AskArrived(nowMs, question, options)`
  - `GEvent.ConfirmArrived(nowMs, confirmId, summary, amountSay)`
  - `GEvent.UserSaid(nowMs, text)`
  - `GEvent.FinishArrived(nowMs, result, say)`
  - `GEvent.PinGate(nowMs, blocked: Boolean, digitTokens: Int)`
  - `GEvent.IntentArrived(nowMs, intent: String)`
- **New effects:**
  - `Effect.SendAnswer(text)`
  - `Effect.SendConfirmReply(confirmId, accepted, utterance)`
  - `Effect.EnterPinMode`, `Effect.ExitPinMode`
  - `Effect.StopUploads`, `Effect.ResumeUploads`
- **Consumed by A4-3 and A4-4:** `YesNo.parse(text, locale): Boolean?` in `TaskTurns.kt`, with these word lists:
  - yes: `yes, yeah, yep, haan, हाँ, हां, sí, si`;
  - no: `no, nope, nahin, नहीं, no`;
  - anything else → null.

- [ ] **Step 1: Write the failing tests** (`TaskStateMachineTest`):
  - `askRepeatsOnceAfter10sThenListens`
  - `confirmCancelsAfter15sWithPaymentNotConfirmed`
  - `confirmYesSendsReplyAndKeyframe`
  - `verifyOkInTaskIntentGoesToAwaitNext`
  - `awaitNextResendsLocateAfter6sThenAsks`
  - `pinGateDuringVerifyingBlocksUpload`: `PinGate(blocked=true)` in VERIFYING → `[StopUploads, EnterPinMode]`, state PIN_MODE.
  - `pinExitAfterFewerThan5DigitsFor2s` → `[ExitPinMode, ResumeUploads, SendKeyframe(LOCATE)]`.
- [ ] **Step 2: Write `FlowReplayTest`.** For each flow, feed the server messages (mapped to GEvents) and assert the client messages emitted (mapped from Effects) in order.
- [ ] **Step 3: Run** `./scripts/android.sh :core:guidance:test` → the new tests fail.
- [ ] **Step 4: Implement** the transitions with the guidance-spec §8 timeouts. Guide intent keeps the current `verify.ok → DONE` path.
- [ ] **Step 5: Run** the same command → all pass, existing 112 included.
- [ ] **Step 6: Commit:** `feat(guidance): task turns, confirm, PIN mode states`

#### A4-2: device safety policy (guidance-spec §11)
**Files:** Create `core/guidance/.../SafetyPolicy.kt` and its test.

**Interface:** `class SafetyPolicy`:
- `fun onConfirm(confirmId: String)`
- `fun onConfirmReply(confirmId: String, accepted: Boolean)`
- `fun mayGuide(role: String, elementId: String, confirmIdForTarget: String?): Boolean`
- `fun speakUncertain(role: String, confidence: Double, ocrAgrees: Boolean): Boolean`

- [ ] **Write the tests:**
  - `payRefusedWithoutAcceptedConfirm`
  - `acceptanceIsPerConfirmId`
  - `iconBelow075SpeaksUncertainty`
  - `textMismatchSpeaksUncertainty`
- [ ] **Implement, then wire it into A4-1:** a refused `TargetArrived` → `Say("I need you to confirm the amount first.", SAFETY)` and the state stays AWAIT_NEXT.
- [ ] **Commit:** `feat(guidance): device-side pay confirm policy`

#### A4-3: PIN mode on device
**Files:**
- Create: `core/guidance/.../Keypad.kt` (pure) and `app/.../engine/PinMode.kt`.
- Modify: `engine/GuidanceEngine.kt`, `session/Keyframer.kt`.

**Interface:**
- `enum class KeypadLayout { PHONE, CALCULATOR, SCRAMBLED }`
- `fun classifyKeypad(tokens: List<OcrToken>): KeypadLayout?`:
  - PHONE when the top row is 1-2-3;
  - CALCULATOR when the top row is 7-8-9;
  - SCRAMBLED otherwise;
  - null with fewer than 7 digits.
- `class DigitUnderFinger(debounceMs: Long = 150) { fun update(nowMs: Long, padUv: Vec2?, tokens: List<OcrToken>): Char? }`: returns a digit only when it changed and has been stable for 150 ms.

- [ ] **Write the tests:** `phoneLayout`, `calculatorLayout`, `scrambledLayout`, `digitDebounced150ms`, `noDigitWhenBetweenKeys`.
- [ ] **Implement `PinMode.kt`:**
  - audio-route check via `AudioManager.getDevices(GET_DEVICES_OUTPUTS)`, accepting types WIRED_HEADSET, WIRED_HEADPHONES, BLUETOOTH_A2DP, BLE_HEADSET and USB_HEADSET;
  - speak through a dedicated `TextToSpeech` utterance;
  - make sure no digit reaches `Log`, Crashlytics or any `Flow` that's collected for telemetry.
- [ ] **On-device check:** with the tablet pin pad in all 3 layouts, record:
  - (a) the layout announced correctly;
  - (b) the gateway log shows no keyframe after `pinModeEntered`;
  - (c) the speaker says "Connect earphones" with no earphones.
- [ ] **Commit:** `feat(android): local PIN mode with earphone-only digit readout`

#### A4-4: EN/HI/ES strings and TTS voices
**Files:**
- Create: `core/guidance/.../Strings.kt`, holding a `Map<Locale, Map<Key, String>>` for every `Prompts` and `Phrases` entry and every A4 string.
- Modify: `Prompts` call sites, `engine/TtsSpeaker.kt`.

- [ ] **Test `StringsTest.everyKeyHasAllThreeLocales`.**
- [ ] **TTS:** `setLanguage(Locale("hi","IN"))` / `Locale("es","ES")`. If it returns `LANG_MISSING_DATA`, say once in English: "Hindi voice not installed; using English."
- [ ] **Commit:** `feat(android): Hindi and Spanish guidance strings`

#### A4-5: settings screen
**Files:** Create `app/.../settings/{Settings.kt,SettingsScreen.kt}` (DataStore).

**Interface:** `data class Settings(val speech: Boolean = true, val tone: Boolean = true, val haptics: Boolean = true, val speechRate: Float = 1.0f, val verbosity: Verbosity = NORMAL, val handedness: Hand = RIGHT, val holdMode: HoldMode = HANDHELD, val locale: String = "en", val privateMode: Boolean = false, val volumeKeys: Boolean = false)`. These are the design §3.4 and §3.6 settings.

- [ ] **TalkBack:** every control has a content description, and a single swipe order is checked with TalkBack on the device.
- [ ] **Commit:** `feat(android): settings screen`

### Lane B — brain

#### B4-1: model router
**Files:**
- Create: `services/gateway/src/models/router.ts` and `test/router.test.ts`.
- Modify: `app.ts`, `session/controller.ts`.

**Interface:**
- `createRouter(o: { meta: ModelPort; glimmer?: ModelPort; breaker?: Breaker }): RoutedModels`
- `RoutedModels.forSession(privacy: 'normal'|'private', sensitivity: Sensitivity): ModelPort`
- Behaviour:
  - private, or sensitivity `financial|identity` → glimmer, or throws `PrivateUnavailable` when none;
  - normal → meta, with `parseScreen` falling back from `muse-spark-1.3` to `-1.2` on a 5xx or timeout.

- [ ] **Write the tests:**
  - `private session never calls meta`
  - `financial layout switches later frames to glimmer`
  - `spark 1.3 timeout falls back to 1.2 once`
  - `PrivateUnavailable becomes mode{private} + spoken error`
- [ ] **Implement:** `parseScreen` takes a `model` option. `liveModels` passes `MODELS.spark`, then `MODELS.sparkFallback`.
- [ ] **Commit:** `feat(gateway): model router with private routing and Spark fallback`

#### B4-2: agent loop with policy
**Files:**
- Create: `services/gateway/src/agent/{loop,tools,policy,intent}.ts`, `prompts/agent.v1.md`.
- Create tests: `test/agent-loop.test.ts`, `test/policy.test.ts`, `test/flows.test.ts`.

**Interfaces:**
- `inferIntent(goal: string, mode: HelloMode): Intent`. `task` when the goal has an ordering or paying verb or two or more nouns joined by "and" (`order|buy|pay|book|check in|ticket|और|comprar|pagar|pedir`), otherwise `guide`. `explore` when it matches `/what('?s| is) on|read the screen|explore|क्या है|qué hay/`.
- `class AgentSession { constructor(d: { models: ModelPort; send; now; tools?: ToolImpl }); onGoal(text): void; onLayout(layout: Layout): Promise<void>; onAnswer(re, text): void; onConfirmReply(re, accepted): void; onVerify(result): Promise<void> }`
- `class Policy { allowGuide(el: LayoutElement): {ok:true}|{ok:false; say:string}; recordConfirm(confirmId, elementIds: string[]); accept(confirmId); step(fingerprint): 'ok'|'budget'|'loop' }`
- **Tools:** the JSON schemas for the 9 tools in design §4.3 live in `tools.ts`. They map to messages:
  - `guide_to` → `target`
  - `ask_user` → `ask`
  - `confirm_with_user` → `confirm` (the policy records which element ids it covers)
  - `say` → `say`
  - `wait_for_screen_change` → `expect`
  - `go_back` → `target` on the role `back` element
  - `finish` → `finish`

- [ ] **Write the tests** (mock Spark returns scripted tool calls):
  - `completes medium-cola flow` (driven by the flow fixture)
  - `guide_to pay without confirm is refused and the model is told why`
  - `yes to an earlier confirm does not unlock a new pay target`
  - `step budget 20 ends with finish{failed} and a spoken reason`
  - `same fingerprint 3 times asks to go back`
  - `recovers when the screen goes back`
  - `guide intent keeps the Day 2 single-target path`
- [ ] **Run them:** `pnpm --filter @fingerpost/gateway test -- agent policy flows` → fail.
- [ ] **Implement:**
  - Use OpenAI-compatible tool calling on Spark with the `agent.v1` system prompt, cache-friendly (static text first).
  - Keep state = goal + the last 5 layout summaries (labels and roles only) + steps.
  - `SessionPipeline` delegates to `AgentSession` when the intent is `task`.
- [ ] **Run again** → pass. `pnpm -r test` stays green.
- [ ] **Commit:** `feat(gateway): agent loop with confirm policy, budget and loop detection`

#### B4-3 🔑: Glimmer private parse on Modal
**Files:**
- Create: `services/private-models/{app.py,README.md}` and `services/gateway/src/parse/glimmer-parse.ts`.
- Test: `test/glimmer-parse.test.ts`.

- [ ] **Mock-first:**
  - `glimmerModels(client: OpenAI): ModelPort`, where `parseScreen` reuses `toLayout` + the `SparkScreen` schema with `model: process.env.GLIMMER_MODEL`, and `segmentByBox` returns `{polygon:null}` (geometry comes from device OCR).
  - Test it with a fake OpenAI client returning the existing `spark-parse.response.json`.
  - Config: `GLIMMER_URL`, `GLIMMER_TOKEN`, `GLIMMER_MODEL`, all optional. `privateAvailable` = all three set.
- [ ] **🔑 Live:**
  - `app.py` serves vLLM's OpenAI server for Glimmer on an L40S, with `scaledown_window=300`, proxy auth and request logging off.
  - Deploy: `modal deploy services/private-models/app.py`.
  - Run the 20-image eval: `--set day1 --mode private`.
  - Record parse p50 and element recall in `docs/evals/report-glimmer-day4.md`.
- [ ] **Commits:**
  - `feat(gateway): Glimmer private parse adapter`
  - `feat(private-models): Modal vLLM app for Glimmer`

#### B4-4: localized server speech
**Files:**
- Create: `services/gateway/src/i18n/strings.ts`.
- Modify: `errors/spoken.ts`, `session/pipeline.ts`, `resolve/describe.ts`, `agent/*`.

- [ ] **Test `strings.test.ts › every key has en, hi, es`.**
- [ ] **Test `pipeline.test.ts › hindi session gets hindi target say`.**
- [ ] **Implement:** `t(locale, key, vars)`. `describePosition` gets localized position words.
- [ ] **Commit:** `feat(gateway): Hindi and Spanish server speech`

### Lane C — quality + story

#### C4-1: sim scenes 3/5/6 and the PIN step in fast-food
**Files:**
- Create: `apps/web/src/sim/scenes/{checkin,adversarial}.ts`, `apps/web/test/scenes4.test.ts`, `apps/web/test/flows.test.ts`.
- Modify: `scenes/fastfood.ts`: `pay-card` → a `pin` screen built from `buildPinPad(seed, layout)`, then `done`.

- [ ] **Write the tests:**
  - `every scene's next targets exist`
  - `fastfood pay leads to pin then done`
  - `adversarial has near-duplicate labels, an icon-only button, low contrast and a Hindi screen`
  - `flows match the sim graph`, using `packages/protocol/fixtures/flows`
- [ ] **Implement** check-in (4 screens: language, booking ref input, seat, boarding pass print-confirm) and the adversarial scenes. The glare overlay is a CSS radial gradient toggled by `?glare=1`.
- [ ] **Verify:** `pnpm --filter @fingerpost/web test` → pass.
- [ ] **Commit:** `feat(sim): check-in and adversarial scenes, PIN step after pay`

#### C4-2: virtual-device flow runner (integration without a phone)
**Files:** Create `evals/src/flow-runner.ts`, `evals/test/flow-runner.test.ts`, and the script `"flows": "node --conditions=source src/flow-runner.ts"`.

**Interface:** `runFlow(flow: Flow, o: { gatewayUrl: string; simRender: (screen) => Uint8Array }): Promise<{ ok: boolean; steps: number; firstDivergence?: { index: number; expected: unknown; got: unknown } }>`. It drives a real gateway socket with the flow's client messages and sim screenshots as keyframes.

- [ ] **Write the test:** start `buildApp` in mock mode with scripted layouts; `runFlow(medium-cola)` → `ok: true`.
- [ ] **Add to CI** as part of `pnpm -r test`. This becomes the nightly A↔B contract check.
- [ ] **Commit:** `test(evals): virtual device flow runner`

#### C4-3: tester session #1 (human) and triage
- [ ] **Run the session** per `docs/tester-protocol.md`. Results go in `docs/evals/tester-1.md`: tasks, times, quotes only with consent.
- [ ] **File each finding as a GitHub issue** labeled `lane:A|B|C` and `P0|P1|P2`. P0s are announced at the next stand-up.
- [ ] **Commit:** `docs(evals): tester session 1`

#### C4-4 🔑: eval report v1 and local PIN-gate recall
- [ ] **Mock-first:**
  - C writes `evals/scripts/export-pin-tokens.ts`. It turns each `pinpay` item's DOM labels into `OcrToken` JSON at `evals/out/pinpay-tokens.json`, with `{text, u, v, w, h, expectedPin: boolean}`.
  - A adds `PinGateDatasetTest` (30 min, lane A's directory). It reads that file through a Gradle test system property and asserts recall ≥0.98 on the `expectedPin` items.
  - Run `./scripts/android.sh :core:guidance:test --tests '*PinGateDatasetTest*'` and report the local recall on sim items.
- [ ] **🔑 Live:**
  - `pnpm --filter @fingerpost/evals eval --set pinpay --mode live` and `--set day1 --mode live` → `docs/evals/report-v1.md`;
  - server recall, local recall, OR-recall against the 98% gate;
  - element recall and target hit;
  - p50 parse.
- [ ] **Commit:** `docs(evals): report v1`

---

## Day 5 — Sat Oct 31: explore, kiosk memory, hardening

**Exit:**
- A known screen gets a target in under 0.8 s, both on-device (local cache) and server (memory).
- A 30-min soak with no crashes.
- Explore works on 3 scenes.

### B5-0 (B, 09:00): contract
- [ ] **Add flows** `explore-summary.json` (with "more") and `memory-hit.json` (`layout.source:"memory"`).
- [ ] **Confirm** no schema change is needed (`Layout.source` already allows `memory`).
- [ ] **Commit:** `test(protocol): explore and memory flows`

### Lane A
#### A5-1: explore summary and touch-explore
**Files:** Create `core/guidance/.../TouchExplorer.kt` and `app/.../engine/Earcons.kt`.

**Interface:** `class TouchExplorer(debounceMs: Long = 150) { fun update(nowMs: Long, padUv: Vec2?, layout: List<ExploreElement>): ExploreCue? }`.
- `ExploreCue` is either `Speak(label, role)` (a new element under the finger, stable for 150 ms) or `Edge` (left an element, plays an earcon).

- [ ] **Write the tests:** `speaksOnEnter`, `noRepeatWhileInside`, `edgeEarconOnLeave`, `textRoleSpokenWithPrefix`.
- [ ] **Wire it in:** voice "explore" or "what's on the screen" → `IntentArrived(explore)` → `keyframe{purpose:"explore"}` → speak the `say`. "Touch explore" turns on a `TouchExplorer` mode over the last layout. It is fully local and makes no uploads.
- [ ] **Commit:** `feat(android): explore summary and local touch-explore`

#### A5-2: on-device layout cache (instant re-lock)
**Files:** Create `core/guidance/.../LocalLayoutCache.kt` (pure; persistence is an interface) and `app/.../memory/DataStoreLayoutStore.kt`.

**Interface:** `class LocalLayoutCache(store: LayoutStore, max: Int = 50) { fun key(tokens: List<OcrToken>, aspect: Double): Long; fun get(key: Long): CachedLayout?; fun put(key: Long, layout: CachedLayout) }`.
- `key` is a 64-bit SimHash of the stable tokens. Tokens with digits or currency symbols are dropped. Look-ups match at Hamming ≤3.
- `CachedLayout` = element ids, labels, roles and polygons. No images.

- [ ] **Write the tests:** `priceChangeStillHits`, `differentScreenMisses`, `lruEvictsAt50`, `clearRemovesAll`.
- [ ] **Wire it in:**
  - On a cache hit with OCR agreement on the target label (`twoSourceAgree`), guide immediately and still send the keyframe for verification.
  - On disagreement, drop the entry.
  - The settings screen gets "Clear saved screens".
- [ ] **On-device check:** a second visit to the fast-food menu reaches the "Found …" speech in <0.8 s.
- [ ] **Commit:** `feat(android): on-device layout cache for instant re-lock`

#### A5-3: tuning from tester #1, Crashlytics, update check
- [ ] **Tune:** apply every `lane:A P0/P1` issue from C4-3. Any number change goes into `docs/guidance-spec.md`, marked `tuned Day 5`, in the same commit.
- [ ] **Crashlytics:** no custom keys with content.
- [ ] **Update check:** at startup, `GET https://api.github.com/repos/Sky-walkerX/fingerpost/releases/latest`. When it's newer, say "An update is available" once per version.
- [ ] **Commits:**
  - `fix(android): guidance tuning from tester session 1`
  - `feat(android): crash reporting and update check`

#### A5-4 (stretch, ≤4 h): DAT mock glasses source
- [ ] **Add the `FrameSource` interface** with `PhoneCameraSource` and `MockGlassesSource` (replays a recorded MP4 from the sim). Cut it first if Day 5 slips.
- [ ] **Commit:** `feat(android): FrameSource with mock glasses`

### Lane B
#### B5-1: explore on the gateway
**Files:** Create `services/gateway/src/explore/summary.ts`, `prompts/explore.v1.md`, `test/explore.test.ts`.

**Interface:** `summarize(layout: Layout, locale): { regions: string[] }`. It's deterministic, with no model call:
- group elements into top, middle and bottom thirds, then left/right;
- each region is one sentence, with at most 5 labels per sentence;
- the first `say` is at most 3 sentences plus "Say more for details."

- [ ] **Write the tests:** `three sentences max`, `more returns next region`, `text role elements included as context`, `hindi output`.
- [ ] **Commit:** `feat(gateway): explore summary by region`

#### B5-2: kiosk memory
**Files:**
- Create: `services/gateway/src/memory/{simhash,store,service}.ts`, `test/memory.test.ts`.
- Modify: `session/pipeline.ts`, replacing `layoutFingerprint` with `fingerprint(ocrTokens, aspect, elements)`.

**Interfaces:**
- `simhash64(tokens: string[]): bigint`
- `hamming(a: bigint, b: bigint): number`
- `lshBands(h: bigint): [string,string,string,string]`
- `MemoryStore` (`get(band)`, `upsert`), with `InMemoryStore` and `FirestoreStore` (`kiosk_layouts`)
- `MemoryService.lookup(tokens, aspect): Promise<Layout | null>`
- `MemoryService.record(layout, attestedKeyId: string): Promise<void>`

- [ ] **Write the tests:**
  - `same screen different price hits`
  - `near-duplicate fingerprint still requires OCR agreement`
  - `trusted only after 2 distinct attested installs`
  - `stores at most 5 salted key hashes`
  - `strips prices, names and numbers before storing`
  - `memory hit path sends layout{source:memory} without calling parseScreen`
- [ ] **Run them**, then implement and run again.
- [ ] **Add a latency test:** the memory-hit path in mock mode takes <50 ms server time.
- [ ] **Commit:** `feat(gateway): kiosk memory with SimHash, LSH and trust rules`

#### B5-3: resilience and prompt caching
**Files:** Create `services/gateway/src/models/breaker.ts`. Modify `router.ts`.
- [ ] **Breaker:** opens after 5 failures in 30 s, half-opens after 20 s; jittered retry 200–600 ms once.
- [ ] **Fallback chain:** Spark 1.3 → 1.2 → Glimmer (if `privateAvailable` and warm) → `mode{offline}` + "Cloud features are paused; basic mode still works."
- [ ] **Prompt caching:** static system prompts first, with a stable prompt-id header.
- [ ] **Tests:** `breaker opens after 5 failures`, `chain ends in offline mode message`.
- [ ] **Commit:** `feat(gateway): circuit breaker and fallback chain`

#### B5-4: load test
- [ ] **Create `services/gateway/scripts/load.ts`:** 50 concurrent virtual devices from C4-2's runner, mock models, 5 min. Report p95 message latency and errors to `docs/evals/load-day5.md`.
  - Pass: 0 errors, p95 <200 ms server overhead.
- [ ] **Commit:** `test(gateway): 50-session load test`

### Lane C
#### C5-1: tester session #2 → issues (same format as C4-3). Commit: `docs(evals): tester session 2`
#### C5-2: privacy, data-safety and install pages
**Files:** `apps/web/{privacy,data-safety,install}/index.html` and the vite inputs.
- [ ] **Content comes from design §4.7.** The install guide is screen-reader-first: numbered steps, with no "click the blue button". A11y check: `pnpm --filter @fingerpost/web test -- a11y` using axe-core (`vitest` + `jsdom`) on each page, with 0 violations.
- [ ] **Commit:** `feat(web): privacy, data safety and accessible install guide`

#### C5-3: README v1 and soak harness
- [ ] **README:** what the app is, a 30-second GIF placeholder, the architecture diagram (mermaid), the Meta tooling map (Spark, SAM 3.1, Voice Transcribe, Glimmer), how to run the mock stack.
- [ ] **Soak harness:** `evals/scripts/soak.md` gives the steps for a 30-min device soak on the sim. A records the crash-free result.
- [ ] **Commit:** `docs: README v1`

#### C5-4 (cut first): donation pipeline
- Only if Day 5 is on track. B adds `POST /v1/donate` (signed URL, 90-day lifecycle) and C adds the consent copy. Otherwise move it to post-hackathon in the known-issues list.

---

## Day 6 — Sun Nov 1: offline, polish, release pipeline

**Exit:**
- v1.0.0-rc1 installs from GitHub Releases on a clean phone.
- The full eval has run.
- P0 count is zero.

### Lane A
#### A6-1: offline basic mode (cut if the Day 5 exit was missed)
**Files:** Create `core/guidance/.../OfflineResolver.kt` and `app/.../offline/{OfflineAsr,OfflineSession}.kt`.

**Interface:** `OfflineResolver.resolve(goal: String, tokens: List<OcrToken>): OfflineResult`, where `OfflineResult` is one of:
- `Match(token)` (token-set ratio ≥0.8);
- `Ambiguous(list)`;
- `None`;
- `IconGoal` (a goal word in the icon lexicon: `wifi, power, settings, back arrow, home, volume`).

- [ ] **Write the tests:** `textGoalMatchesOcrToken`, `ambiguousListsBoth`, `iconGoalSaysCloudNeeded`, `ignoresDigitsInPinGate`.
- [ ] **Wire it in.** Offline mode starts on `mode{offline}`, on no network, or on kill-switch. It uses `SpeechRecognizer` with `EXTRA_PREFER_OFFLINE`, an OCR box as the target polygon, and the same GuidanceEngine. It says "Basic mode: text buttons only."
- [ ] **Commit:** `feat(android): offline basic mode`

#### A6-2: low-vision UI and accessibility audit
- [ ] **Low-vision UI:** the preview shows a 6 dp target outline and fingertip ring, high contrast, a dark default, and text at 200% scale without clipping.
- [ ] **Audit:** Accessibility Scanner plus a manual TalkBack pass over every screen. Results go in `docs/evals/a11y-day6.md`.
- [ ] **Commit:** `feat(android): low-vision preview and accessibility fixes`

#### A6-3: phrasing polish per language
- With C, run a listen-through of every string in all 3 locales on the device and fix the awkward ones. Commit: `fix(android): phrasing polish`

### Lane B
#### B6-1: release pipeline
**Files:** Create `.github/workflows/release.yml`.
- [ ] **On tag `v*`:** decode the `RELEASE_KEYSTORE` secret, run `:app:assembleRelease` signed, write a `sha256sum` file, and create a GitHub Release with the APK and checksum.
- [ ] **🔑** Add the release-keystore digest to `SIGNING_DIGESTS` on Cloud Run.
- [ ] **Verify:** tag `v1.0.0-rc1` on a test branch, download, install on a clean phone (with A).
- [ ] **Commit:** `ci: signed APK release workflow`

#### B6-2: waitlist, config, min version
- [ ] **`POST /v1/waitlist`:** zod email + locale, honeypot field, 5/min per IP, stored in Firestore `waitlist`.
- [ ] **`GET /v1/config`:** `{minVersion, cloudEnabled}` from Remote Config, cached 30 s.
- [ ] **Tests:** `honeypot rejects`, `rate limit 429`, `config cached`.
- [ ] **Commit:** `feat(gateway): waitlist and config endpoints`

#### B6-3: threat model, alerts, runbook
- [ ] **`docs/threat-model.md`:** STRIDE-lite over the auth, session, memory, donate and waitlist surfaces. Each row has a mitigation and the test that covers it.
- [ ] **🔑 Alerts:** error rate >5%, p95 parse >5 s, spend >80% of cap.
- [ ] **`docs/runbook.md`:** kill switch, roll back a revision, rotate secrets, raise quota.
- [ ] **Run `pnpm audit --prod`** and resolve the highs.
- [ ] **Commit:** `docs: threat model and runbook`

### Lane C
#### C6-1: final landing page
- [ ] **Content:** download button + QR to the latest Release, the install guide, privacy, and a waitlist wired to B6-2. The axe check passes.
- [ ] **🔑 Deploy:** `fingerpost.web.app` via Firebase Hosting.
- [ ] **Commit:** `feat(web): launch landing page`

#### C6-2: video script v1, shot list, B-roll
- [ ] **`docs/video/script.md`** follows design §8, timed to 3:00.
- [ ] **`docs/video/shots.md`:** each shot with its device, scene, take count and owner.
- [ ] **Capture B-roll:** cooktop appliance, tablet sim, screen recording of the gateway logs showing "PIN mode: no upload".
- [ ] **Commit:** `docs(video): script and shot list`

#### C6-3: tester session #3 with consented quotes; warm up the X account (3 posts, alt text on every image)

---

## Day 7 — Mon Nov 2: freeze, prove, ship

**12:00 IST feature freeze.** After it, only P0/P1 fixes, each as its own commit with the issue number.

| Time | A | B | C |
|---|---|---|---|
| 09–12 | Last P1s; 30-min soak on 2 phones | 🔑 full live eval runs | Bug-bash sheet: 6 scenes × 3 languages × 2 hold modes × private on/off |
| 12–17 | Bug bash, device half | Bug bash, gateway logs/alerts | Bug bash, drives the sheet, files issues |
| 17–20 | P0 fixes | `docs/evals/report-v1.md` against the §5.6 gates | Demo takes on the appliance + sim |
| 20–22 | Tag `v1.0.0-beta` (B runs `release.yml`); clean-phone install | Min instances 1 (Nov 2–8) | Landing live, waitlist open |

**Exit:**
- Hard gates are met.
- Soft-gate misses are listed in `docs/known-issues.md`.
- Footage is in hand.

## Nov 3–4: video, submission, viral
- **Nov 3:**
  - **C** edits the 3:00 cut with captions and AD-style narration.
  - **A** re-shoots any device shot that fails.
  - **B** writes the README eval numbers, the private-mode verification section (Modal logs) and the submission text.
  - Last office hours at 20:30.
- **Nov 4:**
  - **19:00** X post (60 s cut, alt text, thread), with quote-posts from the team within the hour.
  - **Submit by 21:00 IST.**

---

## Dependency map (what each lane needs from the others)
| Task | Needs | If it's late |
|---|---|---|
| A4-1 FlowReplayTest | B4-0 flows | A writes the flows itself from this plan's contract section, and B reviews |
| A4-2 device policy | nothing | — |
| B4-2 agent | B4-0, B4-1 | B4-2 uses `meta` directly and the router lands after |
| C4-2 flow runner | B4-0 flows, mock gateway | runs against guide-only flows |
| A5-2 cache | Day 3 OCR | — |
| B5-2 memory | Day 3 attestation key id | uses `'dev-key'` in mock mode |
| C6-1 landing waitlist | B6-2 | the form shows the Day 3 "thanks" message |
| B6-1 release | A's release build config | B adds the signing config in `app/build.gradle.kts` via a PR that A reviews |

## Cut lines (in order, decided at the 10:00 stand-up)
1. C5-4 donation, then A5-4 glasses.
2. A6-1 offline: keep only the kill-switch message.
3. B5-2 server memory: keep A5-2 local cache, which already gives the demo re-lock.
4. A5-1 touch-explore: keep the explore summary.
5. The agent shrinks to 2 steps: confirm + pay only.
6. Spanish (design §1 allows it to slip).

**Never cut:**
- PIN mode;
- the confirm gate (device and server);
- auth and quota;
- the 98% recall measurement.
