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
