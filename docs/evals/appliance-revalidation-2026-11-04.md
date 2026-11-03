# Photo, video-frame and speech revalidation — 2026-11-04

**The broader requested flow remains unreliable at `d1e5156`.** All eight public photos and six selected frames from two real videos have now been checked again with real Standard Spark/SAM requests. Eight of ten original synthetic spoken commands have the correct normalized command core. The full-frame guide runs emit no targets. One additional rectified-screen comparison emits an independently aligned washer target, but takes 59.254 seconds. Neither the earlier selected successes nor this crop result establishes general or phone-guidance acceptance.

## Scope and method

- Reuse the exact eight public photos from the [previous multimedia diagnostic](appliance-multimedia-check-2026-11-03.md): two washing machines, two AC remotes, two TV remotes and two microwaves. Retain the knob-only negative. The earlier microwave reference amendment is fixed before this run; no truth is changed after observing these results.
- Reuse the two actual public video clips and their frames at 2, 7 and 12 seconds. Native footage is 1920×1080 for the microwave and 406×720 for the washer; the 1024-wide washer inputs therefore upscale existing detail. These are real sampled frames, not animated stills or fabricated model outputs. Original soundtrack audio is not transcribed.
- Primary flow: hello → typed explore goal → full JPEG → real screen reading/summary or ask → known synthetic English audio through Voice Transcribe → actual final transcript/goal acknowledgement → full JPEG guide request. A correct expected transcript is never substituted into the pipeline. Two local synthetic voices, PCM16LE mono 16kHz and 100-ms chunks reproduce the baseline audio method. This does not test accents, a phone microphone, acoustic noise or Android speech audibility.
- A real HTTP/WebSocket gateway is bound only to loopback with production model adapters and the existing explicit unauthenticated-live development escape hatch. The deterministic guide resolver is used; multi-step Spark task planning, Firebase, Glimmer, Cloud Run and hardware attestation are not tested. The normal 30-second per-call/60-second total-turn policy is retained.
- Main image-guide requests intentionally use `kind:full`, without a device contour/OCR hint, to repeat the baseline acquisition challenge. This is not identical to Android's established-plane path: `CapturePolicy`/`Keyframer` send `kind:screen` after an anchor. A separate comparison below checks that input format without claiming a phone run.
- References and prepared input hashes are retained before requests. No completed provider response is replayed or substituted for a fresh request.

## Eight-photo results

All actual transcripts reach the ordinary goal path. There are no ASR provider errors; two transcripts have the wrong intended command core. A delivered summary means text was emitted, not that a person heard it.

| Case | Listing | Intended spoken core | Guide result | Keyframe → result |
|---|---|---|---|---:|
| washer-01 | Summary, 51.934s | Correct | Ask; parsed label and press candidate exist, but guide masks do not establish a valid plane |55.018s|
| washer-02 | Summary, 46.581s | Correct | Offline at turn deadline after parsing/grounding; no target |60.007s|
| ac-01 | Ask, 51.994s | Incorrect | Ask; expected command matches a raw element, actual transcript matches none |40.031s|
| ac-02 | Ask, 52.811s | Correct | Offline at turn deadline; initial LCD plane excludes controls |60.054s|
| tv-01 | Ask, 51.029s | Correct | Offline at turn deadline; no accepted control plane |60.015s|
| tv-02 | Ask, 50.298s | Correct | Offline at turn deadline; no accepted control plane |60.013s|
| microwave-01 | Ask, 55.540s | Correct | Offline at turn deadline; partial control panel does not acquire a usable plane |60.018s|
| microwave-02, knob negative | Summary, 49.174s | Incorrect | Ask; no target, but wrong ASR and no matched button do not prove semantic rotary-action refusal |39.224s|

No full-frame target is delivered for any of the seven positive photos. Six of their seven recognized commands select the same raw element as the expected command, so successful speech/label resolution is still insufficient for physical guidance. Focused locator outputs alone are not counted as correctly delivered targets.

Visual review confirms that washer-02's **explore** outline follows the black control panel and covers 5/5 manual control points. Its later full-frame guide request still expires. Washer-01's explore plane covers 4/4 points but touches cropped image edges; coverage is not a calibrated boundary-accuracy score. No plane IoU benchmark or press success is inferred from these observations.

## Real video frames

Both original video-case commands are transcribed correctly. No selected video frame emits a target. Function labels remain too dim/small for dependable independent button-identity annotation; identity accuracy is unscored rather than using the model's guess as truth.

| Clip | 2-second guide frame| 7-second guide frame| 12-second guide frame|
|---|---|---|---|
| Microwave | Offline, 60.022s | Ask, 37.487s, independent follow-up | Ask, 52.636s, independent follow-up |
| Washer | Ask, 54.818s | Ask, 25.771s | Ask, 24.406s |

The microwave's primary sequence has one retained driver error: after the offline response, the driver waits for another cloud response in the cancelled turn and does not complete the remaining frames. It is not recorded as a clean sequence or silently discarded. The 7/12-second frames are subsequently checked in independent fresh sessions with the **actual earlier ASR output**, sent explicitly as typed input; no additional ASR call and no expected-text replacement occurs. Both return asks. Thus all six frame files receive a fresh model-backed check, while continuous microwave-video guidance remains failed. The washer sequence completes its three checks in the original session.

These are gateway keyframe checks, not continuous-video inference, optical-flow/fingertip tracking, phone playback or physical guidance.

## Rectified-screen comparison

Android's `CapturePolicy` changes subsequent uploads to rectified screen crops after acquiring an anchor. To test that distinct protocol path, one comparison uses washer-02's **actual accepted explore quad from this run**, not a hand-labelled plane. A local inverse-homography/bilinear transform follows Keyframer's 1024-wide sizing and JPEG quality policy; it produces a 1024×219 JPEG of 47,124 bytes. This is a laptop reconstruction of the input format, not Android/OpenCV execution or a phone test.

The earlier **actual recognized washer goal** is retained and sent explicitly as typed input in a fresh session; no extra speech test is claimed. Spark/SAM responses are fresh. Four image requests produce a target in **59.254 seconds**. Inverse projection through freshly compiled production Kotlin `Homography`/`TargetGeometry` places the anchor inside the original manual button reference; the manual centre is `ON`. Visual review of the overlay agrees. Eight upright/flat cue-direction assertions pass.

This verifies an aligned result for one established-plane input. It does not repair the failed full-frame sequence, prove repeatability, isolate provider variability or satisfy latency/phone acceptance. It must not be added to the full-frame corpus numerator as if the failed washer run passed.

## Validation and accounting

| Batch | Image-model requests | ASR connections | Retained outcome |
|---|---:|---:|---|
| Original 10 cases |109|10|All cases attempted; one failed microwave-video driver sequence retained|
| Two uncompleted video frames |7|0|Both ask, no driver errors|
| Rectified washer comparison |4|0|Aligned target, no driver error|
| Total |**120**|**10**|No phone/cloud acceptance|

- Standard models only: 36 Spark 1.3, 21 Spark 1.2 and 63 SAM 3.1 requests. Source revision is `d1e5156069bb44fb5483383cfc5ac99862eb21da`.
- 96 requests retain HTTP 200 headers; 24 retain no HTTP response after abort/timeout. HTTP 200 alone is not a completed model/segmentation result. No HTTP authentication rejection is retained. The primary run's 19 Spark 1.2 requests show frequent fallback use, not 19 independent successful turns.
- All 129 retained server messages pass the current fp.v1 schema. All six expected video-frame paths are programmatically matched to actual guide-response records. Prepared JPEG hashes/dimensions/payloads and protocol encoding pass preflight. The rectified result is projected into the original image for scoring; no image-space/screen-space boxes are mixed.
- Fresh Kotlin 2.4.21/JDK 21 geometry/cue compilation and eight direction assertions pass. No runtime source or dependency changed during this revalidation. The repair's prior 788 TS/407 Android JVM/80 Python tests are historical validation at this revision, not a new suite execution during this diagnostic.
- Private `.env` bytes remain unchanged in all three batches. Raw media, audio, transcripts, model output, numerical references, overlays and local drivers remain under ignored `evals/datasets/private/appliance-revalidation-2026-11-04/`. Only this non-sensitive report and progress/plan notes are prepared for publication under the user's standing permission.

Local reproduction/inspection commands require that ignored corpus and the pinned toolchain:

```bash
node --conditions=source evals/datasets/private/appliance-revalidation-2026-11-04/check.mjs --check
python3 evals/datasets/private/appliance-revalidation-2026-11-04/score.py
node --conditions=source evals/datasets/private/appliance-revalidation-2026-11-04/validate-results.mjs
```

The actual paid invocations use `check.mjs` without `--check` for the root run and its `video-remaining/` and `rectified-followup/` subdirectories. Completed results are retained; do not rerun them just to rebuild overlays. No phone, deployment, signed release or private account mutation occurred.

## Next engineering work

1. Diagnose frequent Spark fallback and the acquisition/grounding chain's use of the fixed turn budget; measure calls as well as whole turns. The slower results remain failures, not a reason to extend the chosen budget without review.
2. Improve repeatable, valid full-frame control-plane acquisition while preserving out-of-frame refusal, PIN/privacy protection and physical-control confirmation. Keep established-plane crop and initial acquisition tests separate.
3. Resolve the two observed command-recognition failures without substituting expected text, widening matching from one example or claiming synthetic speech covers human microphone behavior.
4. Obtain readable, fully visible flat-touchscreen video references for defensible button-identity scoring. Existing dim/curved/partially framed stress cases remain useful diagnostics but cannot establish the locked MVP benchmark.
5. Once the user supplies a ready phone, verify actual anchor/tracking, speech/tone directions and press/verification. Earlier Day 1–7 quality, latency, performance, privacy, cloud and release gates remain open.

Source attribution and derivative licenses are unchanged; see the [original public source list](appliance-multimedia-check-2026-11-03.md#public-sources-and-derivative-licenses). No raw public-media derivative is committed.
