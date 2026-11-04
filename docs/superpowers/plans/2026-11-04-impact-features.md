# Impact features plan (2026-11-04)

Six features chosen by the user to raise real-world impact and the chance of winning, plus one shared prerequisite. Written for a coding agent working in this repo.

**Before starting:** read `AGENTS.md`, `docs/progress.md` and the spec sections each task cites. All AGENTS.md rules apply: test-first, guidance numbers only from `docs/guidance-spec.md` (add new ones marked `initial value` in the same commit), protocol changes in TS **and** Kotlin together, no pinned-version changes, no secrets/images/audio/transcripts/OCR text in code, logs, tests or commits, and generic device labels. **User preference: commit without AI attribution trailers.**

**Hard safety rules that every feature must keep:**
- the local PIN gate (§10) is never weakened;
- pay/confirm/submit controls are never guided without an accepted `confirm` (§11);
- private and sensitive sessions never touch Meta models;
- nothing is uploaded during PIN mode.

If a feature seems to need any of these relaxed, stop and write a Blocker.

**Done means** the AGENTS.md §4 definition, plus the feature's acceptance below. Phone-only acceptance needs the user to attach the phone (USB debugging on). Mock-gateway runs never count as recognition evidence.

| ID | Feature | Lane | Depends on | Est. |
|---|---|---|---|---|
| IF-0 | Committed live batch driver | C | – | 0.5 d |
| IF-1 | Instant guidance from on-device OCR | A | – | 1–2 d |
| IF-2 | Glimmer private mode live on Modal 🔑 | B | Modal account | 1 d |
| IF-5 | Appliance multi-step tasks + display readback | A+B | IF-0 | 2 d |
| IF-6 | Overcharge guard | A+B | – | 1 d |
| IF-7 | Vibration-only (deafblind) mode | A | – | 0.5–1 d |
| IF-8 | "My devices" saved appliances | A | IF-1 helps | 1–2 d |

---

## IF-0 · Committed live batch driver (prerequisite for honest measurement)
**Why:** the 2026-11-04 diagnosis used an ignored local driver (`evals/datasets/private/appliance-2026-11-04-mac/drive.ts`, present only on the user's laptop). Every feature below needs before/after numbers from the same harness.
- Create `evals/scripts/live-batch.ts`. It runs the production `SessionPipeline` + router + 60 s turn deadline in-process on a case list (`{id, image, goal, refBox|refUV|expected:'ask', quad?}`). It records **per HTTP call** only model, prompt id, SAM concept (fixed allowlist) or `box`, status, latency and token counts; per case it records the final message type, time and whether the target centroid falls inside the reference box (projected through `layout.screenQuad`).
- Inputs stay in ignored `evals/datasets/private/…`. Public photo sources: `docs/evals/appliance-multimedia-check-2026-11-03.md`. Synthetic touchscreens: simulator screenshots composited into a bezel (see `docs/evals/live-quality-2026-11-04.md`). Add a `--cap` request limit (default 150) and `--reasoning`.
- Tests: unit-test the fetch recorder (content-free record shape, cap) and the homography projection with synthetic data. No network in tests.
- **Accept:** `pnpm --filter @fingerpost/evals live-batch -- --help` works; one paid run reproduces today's numbers within noise (4/7 photos, 4/5 touch).

## IF-1 · Instant guidance from on-device OCR
**Why:** the first cloud read takes 8–35 s and is the weakest moment of the demo. Most kiosk and appliance buttons have printed labels the phone can already read.
**Behaviour:**
1. When a guide-intent locate keyframe is sent (online), also resolve the goal **locally**, using the exact algorithm of §11b Locate (`OfflineResolver.kt`, gateway `resolveByText` rules, OCR tokens inside the tracked screen quad).
2. If there is exactly one confident match **and** it is a plain control (not pay/confirm/submit, icon, text, digit-only), start GUIDING immediately with a provisional target ("Boil, bottom right. Checking…"). Use the existing re-lock path in §11c as the model: it already does "guide now, cloud confirms".
3. When the cloud target arrives: if it is the same element (polygon IoU ≥ initial value, or label agreement per §11), continue silently. If it differs, say "Correction: {label}", retarget, and keep the tone continuous. If the cloud asks or refuses, stop guidance and follow the cloud.
4. Never applies in PIN mode, private/sensitive sessions, task intent pay steps, or when the screen quad isn't TRACKING.

**Files:** `core/guidance/{OfflineResolver,GuidanceStateMachine,LocalLayoutCache}.kt`, `app/.../engine/GuidanceEngine.kt`, `engine/FrameRouter.kt`; spec §11c (new "provisional target" subsection with its numbers) and §8 table (LOCATING may enter GUIDING provisionally).
**Tests (JVM first):** provisional guide starts in the same tick as the keyframe; cloud agreement keeps state; cloud disagreement retargets once with "Correction"; cloud ask cancels guidance; no provisional target for pay/confirm/submit/icon/digit/ambiguous/PIN/private/sensitive/untracked; locale strings EN/HI/ES.
**Accept:** on the phone against the live gateway and the simulator (fastfood menu, cooktop), time from keyframe to first direction cue is **< 1 s** for printed-label goals, with no wrong-target corrections across 10 attempts. Report numbers in `docs/evals/`.

## IF-2 · Glimmer private mode live on Modal 🔑
**Why:** the explicit $10k open-weights prize track. The adapter (`services/gateway/src/parse/glimmer-parse.ts`) and Modal app (`services/private-models/app.py`) exist; nothing is deployed (B4-3).
**Human first (blocked until done):** Modal account, GPU credits, `modal token new`; put `GLIMMER_URL`/`GLIMMER_TOKEN`/`GLIMMER_MODEL` in the private `.env` only.
**Steps:**
1. Review `app.py` against the B4-3 plan text in `2026-10-30-days4-7-parallel.md` (vLLM OpenAI server, L40S, `scaledown_window=300`, proxy auth on, request logging off).
2. `modal deploy services/private-models/app.py`. Warm it before measuring.
3. Run IF-0 with private routing (Glimmer parse, device-OCR geometry) on the synthetic touchscreens and the public photos.
4. Phone check: Settings → private mode on. Verify with the gateway logs that **no Meta request** is made during the session (router tests already pin this), then do one guided press on the simulator.
5. Record parse p50, element recall and the Modal usage-log evidence in `docs/evals/report-glimmer.md`, and add the README "Private mode, verified on Modal" section.

**Accept:** a guided press in private mode on the phone, zero Meta calls in that session, and numbers published. Do not commit tokens or Modal logs containing request content.

## IF-5 · Appliance multi-step tasks with display readback
**Why:** "Set the microwave to 2 minutes" or "Cooktop power 5" is daily life. The task agent (`services/gateway/src/agent/{loop,planner,policy,tools}.ts`, Android `TaskTurns.kt`) exists for kiosks only.
**Behaviour:** for appliance layouts, the agent plans a press sequence (e.g. Timer → Plus ×N → Start) and guides one press at a time. After each press it reads the **appliance display** back (OCR on the next verify keyframe) and says it: "Timer shows 2:00". It stops and asks if the display doesn't move toward the goal. It never guesses a hidden mode.
**Known conflict to resolve before coding:** a numeric appliance keypad (3×3 + 0) looks exactly like a PIN pad, and the local PIN gate (§10) must not be weakened. Support plus/minus/preset sequences first. For digit keypads, the plan either uses PIN mode's local digit-under-finger guidance (earphones) or asks the user. Write the decision into the spec; if it needs a product decision, record a Blocker and ask the user.
**Files:** agent planner/tools/policy (appliance plan tool, display-readback tool), pipeline verify path, `i18n/strings.ts`; Android task turns if new turn types appear (prefer existing `target`/`ask`/`say`/`finish`, so no protocol change). Spec: new §8 subsection with step limits (initial values).
**Tests:** planner produces bounded sequences from synthetic appliance layouts; readback parses "2:00", "P5", "5" from synthetic OCR tokens; mismatch → ask; step budget; no plan for unknown icons; existing kiosk flows unchanged (`packages/protocol/fixtures/flows/*` stay green).
**Accept:** on the simulator `cooktop` scene: "set power to 3" guides presses and announces each displayed level, ending in `finish`. Add an IF-0 case with the expected final display.

## IF-6 · Overcharge guard
**Why:** blind users are targeted by overcharging at terminals. The confirm step already reads amounts.
**Behaviour:**
1. During a task, remember the expected total from prices on the chosen items (e.g. "Medium ₹149"), or from a spoken amount ("I expect 149 rupees").
2. At the pay/confirm screen, if the displayed total differs from the expected one, the confirm summary leads with "Warning: the screen says ₹1,490, but you chose ₹149." It still requires an explicit yes and offers "cancel".
3. On a card terminal that triggers local PIN mode, do the comparison **on the device** from local OCR before PIN guidance starts. Speak through the normal channel, or earphones-only if PIN mode is already active.

Amounts are never logged or stored beyond the session.
**Files:** gateway agent policy + confirm builder (`agent/policy.ts`, pipeline confirm path), `i18n/strings.ts`; Android `TaskTurns.kt`/`GuidanceEngine` for the on-device terminal check, with `Strings.kt` EN/HI/ES. Protocol: use the existing `confirm.amount`; if a new field is needed, change TS + Kotlin + fixtures together.
**Tests:** sum of chosen prices; mismatch and match; currency mismatch; rounding (₹149 vs ₹149.00); spoken expectation parsing (EN/HI/ES numerals); no amount in logs (assert the logger output); PIN-mode path uses earphone-only output.
**Accept:** simulator `fastfood` with a tampered total (add a sim query flag such as `overcharge=1` that renders a wrong total) produces the warning; the normal total does not.

## IF-7 · Vibration-only (deafblind) mode
**Why:** inclusion beyond blindness; cheap and memorable. Today haptics only signal near / on-target / lost (§7).
**Behaviour:** a settings preset "Vibration only" (speech off, tone off, haptics on; the existing rule "never all three off" still holds). Direction becomes vibration patterns, every 1.2 s while GUIDING:
- left = two short pulses;
- right = one long pulse;
- up = three short pulses;
- down = long + short;
- closer = faster repetition;
- on target = the existing strong ON pattern.

All state speech (goal prompt, found, errors) is also sent as TalkBack announcements, so braille-display users receive it. A 20-second haptic tutorial in onboarding teaches the patterns.
**Files:** `engine/Haptics.kt`, `core/guidance/{CuePlanner,Cues}.kt`, `settings/{Settings,SettingsScreen}.kt`, onboarding, `Strings.kt`. Spec §7: pattern table and timings (initial values).
**Tests:** pattern selection per error vector (pure JVM); repetition rate vs distance; preset toggles; announcements emitted when speech is off; settings persistence.
**Accept:** on the phone, a blindfolded sighted tester reaches the simulator "Boil" button using vibration only in ≥ 4/5 attempts (or the user's own run); report it.

## IF-8 · "My devices": saved home appliances
**Why:** the same microwave is used every day. Save it once; then recognition is instant, offline and private.
**Behaviour:** after a successful cloud-guided session on an appliance, offer "Save this as a device? Say a name." (e.g. "kitchen microwave"). Store the layout locally: element labels/roles/polygons in screen space plus the OCR fingerprint already used by §11c. Next time, if the fingerprint matches and fresh OCR agrees (§11), guide immediately with no upload. Settings lists saved devices (rename/delete, TalkBack friendly). Never save pay/confirm/PIN/sensitive screens; no images stored.
**Files:** `core/guidance/LocalLayoutCache.kt`, `app/.../memory/DataStoreLayoutStore.kt`, `GuidanceEngine.kt`, `SettingsScreen.kt`, `Strings.kt`. Spec §11c extension: limits (max devices, staleness) as initial values.
**Tests:** save/lookup/rename/delete; fingerprint mismatch → cloud; OCR disagreement drops the entry; sensitive layouts refused; works with the network off (offline mode path); storage contains no image bytes or OCR free text beyond labels.
**Accept:** on the phone, save the simulator cooktop, then airplane mode: "Boil" is guided in < 1 s with zero uploads (the transport counters on the mock gateway stay 0 for keyframes).

---

## Order and handoff
1. IF-0, then IF-1 (largest demo impact). In parallel the user unblocks IF-2 (Modal) and books testers.
2. IF-7 and IF-6 (small, safety/inclusion stories).
3. IF-8, then IF-5 (resolve the keypad/PIN decision first).

After each task: update `docs/progress.md` (status + one log line with numbers), add or extend a `docs/evals/` report, run `pnpm -r typecheck && pnpm -r test`, `python3 -m unittest discover -s scripts -p 'test_*.py'`, and the Android tests/lint/APK via `./scripts/android.sh` (on macOS set `FINGERPOST_JAVA_HOME` to a JDK 21 home and `ANDROID_HOME`), then `git pull --rebase && git push`.
