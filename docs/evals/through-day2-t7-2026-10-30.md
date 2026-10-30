# Verification through D2-T7 — 2026-10-30

Owner: Codex. Scope: repeat available checks through D2-T7, exercise live Meta integration, fix failures, and retain unmet acceptance requirements. The user confirmed the real-photo dataset and Cloud Run setup are not ready and requested all other available checks. Incoming work through `f6daf08` is preserved; this pass starts from `b95e204`.

## Startup defect fixed

The documented source gateway command could not load its imports under native Node 24. Newly integrated auth/quota classes used constructor parameter properties, which Node's TypeScript stripping rejects with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. Vitest transforms TypeScript and therefore did not expose this failure.

A new child-process regression first failed with that exact error in `auth/challenges.ts`. Explicit fields/assignments now preserve the same constructor API and behavior in challenges, rate limiting, revocation, quotas and stores. Gateway typechecking enables `erasableSyntaxOnly` to catch a recurrence. One test helper received the equivalent syntax correction; no assertion, security policy, dependency version or public protocol changed. The native runtime regression and existing auth/quota tests pass.

## Automated checks

| Command/check | Result |
|---|---|
| `pnpm -r test` | **328 pass:** protocol 48, web 20, gateway 254, evals 6 |
| `pnpm -r typecheck` | Pass, including native-compatible syntax enforcement |
| `pnpm -r build` | Pass for every package with a build script |
| `pnpm --filter @fingerpost/protocol schema` | Both schemas exported successfully |
| `python3 -m unittest discover -s scripts -p 'test_*.py' -v` | **29 pass:** tracking 24, deployment orchestration 5 |
| `./scripts/android.sh :core:guidance:test --rerun :core:protocol:test --rerun :app:testDebugUnitTest --rerun --console=plain` | **202 cases executed:** guidance 148, protocol 49, app 5; zero failures/errors/skips |
| `./scripts/android.sh :core:guidance:test :core:protocol:test :app:test :app:assembleDebug :app:lintDebug --console=plain` | Debug build and lint pass; six existing lint warnings, zero errors |
| APK/model integrity | APK ZIP valid; bundled model matches the pinned SHA-256 and 7,819,105-byte asset |
| Native source entry point | Mock `src/server.ts` starts and answers `/healthz`; stderr empty |
| Fresh gateway container build/run | Frozen production dependency install/build passes; compiled mock voice → target → simulator press → verify passes; health valid; UID 1000; verification container removed |
| `bash -n infra/deploy-gateway.sh`; `git diff --check` | Pass |

No tests were skipped, weakened or deleted. Gradle's plugin configuration checks marked SKIPPED are not test cases. These commands use Node 24, pnpm 11.10.0 and the installed JDK 21/SDK via the repository launcher. Container checks use the repository Dockerfile and the isolated rootless Podman store described in `docs/local-development.md`. All model-independent suites stay offline. Remote CI is checked after pushing the verified changes.

## Actual live gateway exchange

The corrected private credential returned HTTP **200** from Meta's model-list endpoint and an accepted Voice Transcribe handshake. The earlier 401/missing-key blockers are resolved.

A temporary harness ran the actual source `buildApp`, bound only to loopback. It used live Standard Spark 1.3, SAM 3.1 and Voice Transcribe adapters, with **no model or ASR stubs**. Authentication remained enabled: an ephemeral session secret/JWT exercised the authenticated socket path. Quota/flag storage was in memory; Firebase login, hardware attestation and Firestore were not exercised. Debug/simulator tokens were ephemeral and never printed.

Input was a generated nonsensitive appliance-control image and synthesized speech, with no camera or microphone capture. Every response was validated against the existing protocol. Only numerical results and booleans were retained:

| Check | Observed result |
|---|---|
| Typed goal → binary keyframe → Spark layout → SAM target | Pass; five elements; refined mask present; target centre inside the expected button; confidence 0.99 |
| First locate timing | Spark 6,715 ms; SAM 5,480 ms; keyframe → target receipt 12,227 ms |
| Binary PCM through gateway → live ASR → final transcript → goal acknowledgement | Pass; one partial and exactly one final; expected goal matched; 79,662 audio bytes sent |
| ASR elapsed time | 4,499 ms from first audio send to goal acknowledgement, **including paced audio transmission** |
| Re-locate from the spoken goal | Pass, with actual Spark and SAM calls |
| Simulator authentication and run delivery | Wrong token rejected (401); correct token delivered to exactly one linked session; `sim.touch` received |
| Verify after the linked press | Pass; `verify.result = ok` |
| Model usage during this flow | Three Spark calls, two SAM calls, one ASR utterance |

The nine-field ASR handshake, including language bias and nonempty screen-label keywords, was accepted without modifying it. No extra access-token credential or provider-specific workaround was needed. D2-T7 **Step 4 passes** for this isolated live gateway/session check. This is not a deployed-service or phone acceptance result.

The existing `measureFullRegion` path also completed **one local live diagnostic** through `/healthz`, `/v1/debug/asr-connect` and the authenticated debug binary target route. It measured RTT 23 ms, ASR upgrade 2,811 ms, accepted handshake 3,943 ms, Spark 6,545 ms, SAM 4,954 ms and keyframe → target 11,514 ms, with zero mask fallbacks. It added one Spark call, one SAM call and a no-audio ASR probe. These are individual diagnostic observations, **not** regional percentiles, quality acceptance or SLO evidence. No region was ranked or selected. The observed multi-second target response remains a latency concern for the required regional evaluation.

Test media, transcripts, recognized labels, session ids, raw provider errors and credentials are absent from this report and Git. Synthetic media remained in a private temporary directory and was removed after checking. No real panel image, microphone audio or camera frame was uploaded.

## Unfinished acceptance and next actions

| Task | What still prevents completion |
|---|---|
| D1-T0 | Remaining human setup/credits, cloud/billing/registry, photos, name checks and outreach. API access is verified; credit balance is not. |
| D1-T5 | Zero approved Day 1 JPEGs and no private latency crop. Ten-photo smoke and manual ≥8/10 correctness scoring cannot run. Cloud CLI/setup and candidate URLs are unavailable; two matching-revision deployments, 20 samples per region and ADR-0003 acceptance remain open. |
| D1-T6 | Physical Android tablet fullscreen/flow/export/scrambled-PIN acceptance remains unverified. |
| D1-T7c | Tracking's ≥25 FPS / ≤25 ms gate still fails in retained measurements. No Android device is detected in this pass; cold-device profiling and deferred visual/TalkBack regression cannot be repeated. |
| D2-T7 Step 5 | Redeploy after D1-T5 selects a region and the required cloud/Firebase credentials, signing configuration, IAM and secrets exist. The current deployment script also requires signing digests as its third argument. |

D2-T1–T6 retain their completed logic/package statuses. **D2-T7 stays blocked solely on regional deployment acceptance**, with its local/live integration check now recorded. Day 1 remains incomplete. No later task is marked done or started by this testing pass. Teammates retain the separate Android integration acceptance checklist.

Next human input: approved panel photos and the private crop, then cloud setup. Next engineering step: run D1-T5 smoke/overlay scoring and both regional measurements, accept ADR-0003 only from that evidence, then execute D2-T7's redeployment check. Device profiling/tablet checks can proceed independently when the relevant devices are available.
