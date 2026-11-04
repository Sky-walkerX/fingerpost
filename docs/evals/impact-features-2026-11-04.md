# Impact features verification — 2026-11-04

## IF-0: reproducible live batch

`evals/scripts/live-batch.ts` uses the production SessionPipeline, router and 60-second turn deadline. Inputs and results must stay under ignored `evals/datasets/private`. Use `pnpm --filter @fingerpost/evals live-batch -- --help`; the historical extra separator is accepted. Credentials come from the environment. Output files must be new, inside an existing private directory. No dependency or protocol change.

The same 13 inputs and reference boxes as [the diagnosis](live-quality-2026-11-04.md) were run once with low parse reasoning: **58 paid requests, 4/7 positive photos aligned, 4/5 synthetic touchscreens aligned**, and the knob-only negative asks without a target. These reproduce the earlier single-run observations. All call records reached terminal outcomes; 20 include provider usage counts. Cancelled requests need not report usage. The check-in submit still ends with a safety say and no target. This is laptop recognition evidence, not physical or cloud acceptance.

Only allowlisted model/prompt ids and SAM concepts (otherwise `box`), numeric HTTP status, latency, terminal outcome and token counts are recorded. No goals, questions, output text, URLs, credentials or media enter results. The request cap is reserved before asynchronous body inspection, preventing concurrent calls from exceeding it. Four synthetic tests cover record privacy, stream usage, failure redaction, concurrent cap and perspective/degenerate projection. They failed first on the missing module.

Validation: recursive typecheck; full TS suite (810 before the fourth cap test, which also passes separately); 80 Python cases; baseline Android JVM tests/debug APK/lint pass. Sandbox restrictions required rerunning loopback tests and Gradle/signing-cache access with approval. No versions changed. Private files and `.env` remain excluded.
