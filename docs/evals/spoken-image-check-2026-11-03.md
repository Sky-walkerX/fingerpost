# Public-image and spoken-goal check — 2026-11-03

The requested pipeline does **not** yet pass end to end. This follow-up goes beyond the earlier typed-goal diagnostic: real screen parsing and segmentation, screen listing, synthetic spoken audio through Voice Transcribe, goal delivery and returned target geometry. A returned target is not evidence of a correct physical press.

## Method and limits

- Three public photographs: A, a photographed ticket touchscreen; B, a tilted flat cooktop with partial occlusion; C, a raised-button remote, which is a stress case outside the flat-touchscreen MVP.
- Real loopback HTTP/WebSocket gateway and production Standard Spark/SAM/Voice Transcribe adapters, unchanged `parse-screen.v1` prompt, deterministic guide planner and bounded live wait. No simulated provider result was substituted. Authentication used only the existing explicit loopback development escape hatch; private environment and production policy were unchanged.
- Images were resized to 1024 pixels wide and kept within the binary payload bound. Manual button references were chosen before requests. Audio was synthesized locally as PCM16LE mono 16 kHz; no person's microphone, speech or camera was captured.
- Only A exercises listing before speech. B and C exercise spoken goal → actual transcription → keyframe → target/ask. Listing checks gateway summary-text emission, not Android TTS audibility. This does not test multi-step Spark planning, live finger tracking or physical guidance.
- Original raw temporary responses became unavailable after temporary storage reset. The timings and numeric geometry below were retained in the session record. The local overlay is reconstructed from those coordinates and the original ignored public photo, not presented as a retained provider response. No paid requests were repeated merely to regenerate evidence. Reproducible corpus acceptance remains open.

## Observed results

| Sample | Speech and listing | Image/target result | Time |
|---|---|---|---|
| A, first full flow | 22 elements listed and summary emitted; ASR rejected the screen-label keyword payload | No spoken-goal target | Listing 21,239 ms |
| B | Spoken goal transcribed correctly and delivered to the guide resolver | Target emitted, but its anchor misses the manual button reference | ASR 1,930 ms; keyframe to target 32,209 ms |
| C, stress case | Short spoken goal transcribed incorrectly | Asked for framing/clarification; no target. Primary display excludes the buttons and alternate appliance segmentation returns no mask | ASR 2,429 ms; keyframe to ask 22,719 ms |
| A, fresh flow after keyword repair | Listing succeeds; ASR accepts the keyword payload but duplicates part of the spoken goal | Goal delivered, then ask instead of target | Listing 18,176 ms; ASR 2,698 ms; keyframe to ask 19,800 ms |

The initial flow uses nine image requests and three ASR connections; the fresh repaired A flow uses four image requests and one ASR connection. These few samples are not an accuracy percentage, representative benchmark or latency percentile. Model geometry and transcription remain separate failure points.

### Reproducible configuration bug, repaired

The first A flow supplies 17 screen-label hints, including hints longer than 30 characters. A controlled comparison with the identical audio reproduces provider rejection with that original keyword list in 1,914 ms. The same audio transcribes correctly with no hints in 2,689 ms and with one valid short hint in 2,316 ms. The oversized-keyword error had occurred twice before the input was changed.

`asr/relay.ts` now trims hints, discards blanks and hints over 30 Unicode characters, then caps valid hints at 50. It does not truncate or rewrite labels. Three synthetic tests fail before the fix and pass afterward: boundary/immutability, supplementary Unicode characters and filtering before the cap. Existing tests remain unchanged. The fresh A flow confirms provider acceptance after repair; its remaining transcription error is **not** marked fixed.

The 30-character constraint is an observed provider rejection, not a limit published in the [schema reference](https://dev.meta.ai/docs/api-reference/voice/schemas). That reference describes hints as a bias, without guaranteeing exact spelling. Do not automatically strip repeated words from recognition output or loosen matching based on this one sample.

### Target alignment remains wrong

For B at 1024 × 768, the manual reference spans x=811.008–868.352, y=529.152–585.216. The returned guidance anchor maps to approximately (798.514, 562.302), outside that reference. Production pure-Kotlin homography/target geometry classifies the manual button centre as `NEAR`, not `ON`. Eight conditional direction assertions pass, but they validate the mathematics given coordinates; they do not validate model localization or camera coordinates.

The target polygon overlaps the button only partially. Refinement consistency with a Spark box cannot certify that either model selected the right physical pixels. Do not report the safe-looking target response as correct guidance. Occlusion and ambiguity between the whole appliance and its control strip also prevent a defensible screen-boundary accuracy score here.

## Local verification

```sh
pnpm -r typecheck
pnpm -r test --maxWorkers=2
pnpm --filter @fingerpost/gateway build
```

733 TypeScript tests pass: protocol 67, web 53, gateway 547, evals 66. Recursive typechecks and gateway build pass. No dependencies or pins changed. This follow-up changes only ASR provider input validation and documentation; earlier Android build/JVM evidence belongs to the [preceding repair](live-guidance-repair-2026-11-03.md), not a fresh phone run.

Local ignored artifacts: `evals/datasets/private/live-guidance-2026-11-03/` contains the rerun validation log, retained numeric geometry summary and reconstructed target overlay. No secrets, media, labels or transcripts are added to tracked fixtures or logs. No commit, push, deployment, account setup or device test was performed.

## Remaining work

- D1-T5 / D2-T7 / D2-T10c: repeat a fixed, independently labelled flat-touchscreen corpus with typed and spoken goals separately; measure screen plane, resolved label, target polygon and anchor instead of target-message presence. Retain private raw evidence through the run.
- Resolve speech accuracy and model grounding failures before claiming reliable guidance. Avoid sample-specific coordinate offsets or unverified prompt replacements.
- When the user reconnects a phone, check real screen lock, microphone/TTS turn-taking, index-tip alignment in both orientations, cue direction and an actual press/verification on a non-sensitive flat touchscreen. User deferral remains in force; no still-image or JVM result substitutes for this.
- Earlier quality/latency, tracking, PIN/payment, cloud/auth/region and release gates remain open. No task is reclassified as accepted complete.

## Public image attribution

- A: Hassocks5489, [photographed ticket touchscreen](https://commons.wikimedia.org/wiki/File:Southern_Scheidt_%26_Bachmann_TVM_at_Hove_Railway_Station_(October_2016)_(Detail_of_Screen).jpg), CC0.
- B: MDeWorld, [cooktop photograph](https://commons.wikimedia.org/wiki/File:HK_PRChina_Product_Midea_Induction_Cooker.JPG), [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Local diagnostic image is resized, cropped and annotated; no endorsement is implied.
- C: Lee Haywood, [remote photograph](https://commons.wikimedia.org/wiki/File:Air_conditioning_remote_(4141300928).jpg), [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/). Used only as the separate stress case.
