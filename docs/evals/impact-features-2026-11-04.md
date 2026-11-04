# Impact features verification — 2026-11-04

## IF-0: reproducible live batch

`evals/scripts/live-batch.ts` uses the production SessionPipeline, router and 60-second turn deadline. Inputs and results must stay under ignored `evals/datasets/private`. Use `pnpm --filter @fingerpost/evals live-batch -- --help`; the historical extra separator is accepted. Credentials come from the environment. Output files must be new, inside an existing private directory. No dependency or protocol change.

The same 13 inputs and reference boxes as [the diagnosis](live-quality-2026-11-04.md) were run once with low parse reasoning: **58 paid requests, 4/7 positive photos aligned, 4/5 synthetic touchscreens aligned**, and the knob-only negative asks without a target. These reproduce the earlier single-run observations. All call records reached terminal outcomes; 20 include provider usage counts. Cancelled requests need not report usage. The check-in submit still ends with a safety say and no target. This is laptop recognition evidence, not physical or cloud acceptance.

Only allowlisted model/prompt ids and SAM concepts (otherwise `box`), numeric HTTP status, latency, terminal outcome and token counts are recorded. No goals, questions, output text, URLs, credentials or media enter results. The request cap is reserved before asynchronous body inspection, preventing concurrent calls from exceeding it. Four synthetic tests cover record privacy, stream usage, failure redaction, concurrent cap and perspective/degenerate projection. They failed first on the missing module.

Validation: recursive typecheck; full TS suite (810 before the fourth cap test, which also passes separately); 80 Python cases; baseline Android JVM tests/debug APK/lint pass. Sandbox restrictions required rerunning loopback tests and Gradle/signing-cache access with approval. No versions changed. Private files and `.env` remain excluded.

## IF-7: vibration-only coding

The preset uses existing persisted output switches (speech/tone off, haptics on); the last-output rule remains. Directional haptics run from fresh finger errors in screen axes, independently of speech magnitude. State exits, stale hands/tracking, PIN and shutdown cancel them. Audio earcons honor the tone switch. Speech-off utterances emit accessibility announcements, excluding PIN content. Onboarding has a localized five-lesson, 20-second tutorial and an accessibility custom action.

Three failing-first JVM cases cover four directions, invalid errors, cadence/reset and localized tutorial structure; settings tests verify the preset, and the existing all-fields roundtrip persists exactly these speech/tone/haptics values. Full local verification passes: 811 TS tests and typecheck, 80 Python tests, Android JVM/debug APK/lint (zero errors, 16 existing warnings). Lint's configuration-aware resource issue was fixed, not suppressed. Physical 4/5 navigation and braille delivery remain unmeasured; IF-7 stays blocked on that acceptance.

## IF-1: provisional OCR guidance coding

The user explicitly chose a conservative EN/HI/ES label allowlist over requiring a previously classified layout. The spec records that decision and all words; unknown labels wait for classification. Resolution uses the exact OfflineResolver and the sent keyframe's OCR, transformed through its capture quad, after the production PIN gate. The main callback starts guidance immediately, only for TRACKING normal guide sessions. Cached re-lock also now rejects private/sensitive/untracked sessions. Cloud label agreement silently adopts the current polygon; disagreement retargets with one localized correction. Asks, confirmation, errors, safety refusal, mode changes and sensitive layouts cancel early guidance. No protocol change.

Three missing-API tests failed first, then passed: exclusions/ambiguity, all locales and same-tick state transitions with tone-preserving correction/cloud ask. Full 811 TS tests/typecheck, 80 Python tests and Android JVM/debug APK/lint pass (zero errors/16 existing warnings). Phone keyframe-to-cue timing and ten-attempt correctness are unmeasured; no latency claim.

## IF-6: overcharge guard

Four gateway regressions cover sums, explicit expectations, EN/HI/ES numerals/currencies, matching minor units, mismatch, currency changes, ambiguous prices and console silence. Actual AgentSession confirms warn only for the tampered total and leave payment locked. Two failing-first JVM cases cover local OCR comparison, language support, reset and protected output selection. A synthetic web scene test pins that only the displayed total changes. A real headless browser clicked Start order → Drinks → Medium on both normal and `overcharge=1` fastfood URLs and verified each displayed total. No paid model call was needed; this is deterministic simulator acceptance. The unchanged confirmation policy requires explicit yes.

Full checks pass: recursive typecheck, 822 TS cases (including concurrent web tests), 80 Python cases, Android JVM/debug APK/lint (zero errors/16 existing warnings). Earphone playback on a physical terminal is not established by JVM routing checks. No amount persistence or logging API was added.

## IF-2: human prerequisite

Reviewed existing Modal deployment config against B4-3: L40S, OpenAI-compatible vLLM, 300-second scaledown, proxy authentication, request/access logging off. Private Glimmer configuration is absent. Account/credits/token are human-only; no deployment or “verified on Modal” claim. Live batch private routing and phone evidence await those prerequisites.

## IF-8: saved appliances coding

A verified cloud appliance press offers a local-ASR name prompt. Names/fingerprints/control labels, roles and screen polygons persist in DataStore; no images or raw OCR payloads. Storage is bounded and expires; payment/PIN/input/sensitive/non-appliance layouts are refused. A separate local lookup requires TRACKING, OCR within 500 ms and the existing hashed fingerprint/two-source agreement. Hits bypass keyframe requests and use local verify, including basic mode. Mismatches fall back; disagreement deletes the entry. Settings has localized name editing and deletion with accessible actions.

Three failing-first JVM cases cover save/lookup/rename/delete/codec, mismatch/disagreement eviction and sensitive/expired entries. Full checks pass: 822 TS tests/typecheck, 80 Python tests and Android JVM/debug APK/lint (zero errors/16 existing warnings). The save/airplane-mode phone trial, <1 s cue timing and zero-keyframe transport counters remain unrun; IF-8 stays blocked on that physical acceptance.

## IF-5: appliance tasks and measured limitation

The deterministic task path recognizes power-level and timer-minute goals and guides only a known printed Plus/Minus or explicit preset. Every next frame reads a unique local OCR token within the parsed numeric display, agreeing exactly with its label. It announces the reading, checks progress, and finishes at the goal. Missing/stalled/reversed/mode-mismatched displays ask. Existing step/time/confirmation/PIN rules remain; numeric-keypad tasks use the plan's **ask the user** option. No automatic Start or hidden mode is inferred. The simulator's Plus/Minus now update its per-run display without navigation changes.

Eight gateway tests cover numeric-key/sensitive refusal, display forms, bounded sequences, unknown controls, OCR geometry and actual production-pipeline 1→2→3/finish plus unchanged-display ask. The browser preparer creates three real synthetic simulator screenshots under ignored private storage. The batch driver supports expected final display, bounded verify frames and a required expected pressed control: it will not advance prepared images after a different target. This prevents a wrong target from being hidden by a prepared successful image sequence.

Reproduce preparation with a loopback web server on port 5175, then `pnpm --filter @fingerpost/evals exec node --conditions=source scripts/prepare-cooktop-task.ts`; existing takes are refused. Feed its private `cases.json` to `live-batch`. The OCR display boxes are supplied synthetic annotations, **not measured phone OCR**.

Two actual paid production batches returned ask after one parse each (8.525 s, 6.037 s), so **live acceptance failed safely**. One additional bounded parse diagnostic found appliance/non-sensitive classification, seven elements and a correct numeric text label, but the parsed display did not contain the supplied reference centre. The first batch used the whole logical display box; the second used manually annotated visible glyph bounds. Stop retries under AGENTS.md §9; do not loosen agreement to force a target. Raw screenshots/cases/results stay ignored. Need validated local OCR/display geometry and eventual phone evidence. IF-5 remains blocked, despite passing synthetic flows.

Final local checkpoint: recursive typecheck, 833 TypeScript cases, 427 Android JVM cases, debug APK/lint (zero errors/16 existing warnings), 80 Python cases. The batch metric now uses the polygon area centroid, independent of vertex sampling; a synthetic trapezoid regression pins it. No pinned dependency, protocol or private environment change.

### Final area-centroid baseline

Final review replaced the inherited driver's vertex mean with a polygon area centroid. A fresh 13-case batch completes with **62 paid requests, 2/7 positive photos aligned, 4/5 touchscreens aligned**, and the negative asks without a target. Both washer cases ask this time; their change occurs before centroid scoring, so the lower count is recognition variation, not the centroid formula. The two AC photos remain aligned. Do not describe the earlier 4/7 as a repeatable success rate. This is an additional measured limitation, not a repaired live quality gate. The initial 58-request reproduction remains in the report above; both sets of content-free results stay private locally.
