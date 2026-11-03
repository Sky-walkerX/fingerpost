# Appliance photos, video keyframes and speech — 2026-11-03

**The requested guidance flow is not reliable.** The broader check completes eight public photos, two actual public videos and ten known spoken-command flows through the real gateway and Standard model adapters. Speech recognizes the intended command in all ten completed controlled trials. Only one of seven positive photo cases produces an independently aligned target; another emits a misplaced target. This is a diagnostic selection, not an MVP accuracy benchmark or a physical acceptance result.

## What ran

- Two photos each of washing-machine controls, AC remotes, TV remotes and microwaves. Seven have a marked requested control; one microwave has rotary knobs and no discrete requested button. Raised buttons, curved remotes and knobs are stress cases outside design §3.1's flat-touchscreen MVP. Their results are not folded into the required touchscreen acceptance score.
- Two real, openly licensed videos: a microwave and a washing machine. Each supplies actual frames at 2, 7 and 12 seconds. These are not animations of still photos. The first frame is also used for the initial explore request.
- Each completed case follows: typed explore request → JPEG keyframe → actual model parse/segmentation → delivered summary or ask → synthetic spoken command → Voice Transcribe → final transcript → gateway goal acknowledgement → fresh locate keyframe(s). The guide command is not replaced with its expected text. All ten actual transcriptions reach the normal controller goal path.
- Existing production Spark prompt `parse-screen.v1`, Standard Spark 1.3/1.2 fallback and SAM 3.1. The guide planner is deterministic rules, not the multi-step Spark task planner. Public frames enter a real HTTP/WebSocket gateway bound only to `127.0.0.1`, using the existing explicit unauthenticated-live development escape hatch. No private environment or production authentication policy is changed; Firebase/GCP/Modal are not exercised.
- Known English commands are synthesized with two local voices at 150 words/minute, encoded PCM16LE mono 16 kHz, and streamed in 100-ms chunks. This tests actual ASR, not a transcript fixture. It does **not** test a person's accent, phone microphone, acoustic noise, Android TTS playback or TTS/microphone turn-taking. Original video soundtracks are not sent to ASR.
- The gateway consumes JPEG keyframes rather than continuous video. These sequences exercise repeated recognition under the same spoken goal; no raw-video model endpoint, Android video decoder, optical-flow/finger tracking, real-time cue playback or physical press is tested.

## Completed photo results

All eight spoken command cores match the expected command after the production resolver's normalization; no ASR provider error occurs. A summary means the gateway emits INFO text, not that Android speaks it audibly.

| Photo | Explore response | Locate response | Independent result | Locate time |
|---|---|---|---|---:|
| washer-01 | Summary, 45 elements | Target, 24 elements | Anchor inside the marked button; manual centre is `ON` in production Kotlin geometry |48,345 ms|
| washer-02 | Summary, 15 elements | Target, 14 elements | Anchor below/right of the actual button, over its caption; manual centre is `NEAR` |37,343 ms|
| ac-01 | Ask | Ask | Primary mask covers the LCD, excluding the controls; alternate appliance concept returns no mask |29,895 ms|
| ac-02 | Ask | Ask | Same LCD-only acquisition failure; no guidance target |27,385 ms|
| tv-01 | Ask | Ask | No usable display/appliance mask. Initial classification is `pin_pad` with sensitivity `none`; later guide classification is `appliance` |45,455 ms|
| tv-02 | Ask | Ask | Requested label resolves in the raw parse, but no usable control plane exists |20,899 ms|
| microwave-01 | Ask | Ask | Partial framing; available masks fail control coverage, so no layout/target is delivered |29,712 ms|
| microwave-02, knob negative | Summary, 12 elements | Ask | No target, but **not a passed semantic refusal**: the raw guide parse calls a timer dial a button, confidence 0.95, and the requested action matches its descriptive name. Plane validation blocks the result |31,174 ms|

For the two emitted photo targets, inverse projection uses freshly compiled production `Homography`, `TargetGeometry` and cue sources, not a replacement centroid implementation:

- washer-01: guidance anchor approximately (814.152, 416.500) at 1024 × 766; inside the manual reference. This is still-image alignment only.
- washer-02: anchor approximately (688.445, 353.744) at 1024 × 576; outside the actual button reference. The Spark box centre is already displaced before SAM refinement. Both models agreeing with that box does not make it correct.

Control coverage is not the same as an accurate planar boundary. Washer-02's accepted quad covers the known controls but also much of the machine body/drum. It must not be called a correct control-panel outline merely because all five marked control points lie inside it.

The absence of a target on the knob negative does not establish that unsupported rotary actions are safely understood: the raw role/action error remains present and would matter if plane acquisition were improved.

## Completed video results

Both known commands transcribe correctly and reach the gateway. All six locate turns return an ask, with no delivered target. Function labels in these source videos are too dim/small for reliable independent button-identity annotation; target correctness remains unscored, rather than assigning a model guess as truth.

| Video | 2-second frame | 7-second frame | 12-second frame | Initial explore |
|---|---:|---:|---:|---|
| Microwave | Ask,23,447 ms | Ask,23,084 ms | Ask,26,463 ms | Summary,7 elements,21,568 ms |
| Washing machine | Ask,27,701 ms | Ask,24,782 ms | Ask,29,820 ms | Ask,24,396 ms |

This demonstrates real video-frame ingestion and ASR/goal routing, **not successful video guidance**. It does not establish temporal tracking stability or correct physical presses.

## Evidence and validation

All source media, hashes, prepared inputs, known commands, PCM, raw model results, socket messages, independent numeric references, compiled replay and annotated outputs remain under ignored local storage:

`evals/datasets/private/appliance-multimedia-2026-11-03/`

- `cases.json`, `sources.json`, `results.json` and `numeric-results.json` retain the input manifest, source/license metadata, actual responses and numeric scores. No secrets or recognized content are added to tracked fixtures/logs.
- `photo-results-overview.png`, individual result PNGs and `ac-*-rejected-display.png` show actual returned geometry or rejected masks; none is an invented successful target.
- `video-results-overview.png` shows the six actual sampled frames and their responses. Both original WebM files remain available locally.
- `Measure.kt` compiles the pinned Kotlin 2.4.21 production geometry/cue sources with JDK 21 and cached dependencies. Eight upright/flat direction assertions pass. These assertions validate mathematics given coordinates, not device tracking.
- Client-message/schema checks pass before the paid run. An initial local driver omitted the typed goal's required `source` field; the gateway correctly refused it before any model request. The driver was corrected without changing production validation.
- Two long pipe-based execution sessions terminate with exit143 while work is pending. Their partial records are retained in `interruptedCases`; no interrupted request is counted as successful or as an application failure. The remaining cases complete using a PTY with regular polling. The initial budget is explicitly expanded to96 image requests/11 ASR connections to cover the interrupted work, including one repeated utterance. The cause of the external termination is not established.
- Final accounting:86 image requests started (27 Spark1.3,7 Spark1.2,52 SAM),11 ASR connections.77 HTTP200 responses;7 requests end/cancel without an HTTP response at the call deadline;2 interrupted requests have no retained final outcome. All ten selected cases finish without a harness error. No additional model requests are made to draw the overlays.
- All ten ready messages advertise65,000 ms. Completed locate turns range20,899–48,345 ms; ASR final-command timing ranges2,463–3,989 ms. These are individual controlled samples, not representative latency percentiles. The inference latency goals remain unmet.
- References are selected before requests, except one explicitly retained correction: microwave-01's initial box mistakenly covered the central mode button rather than the requested left-hand control. `reference-amendment.json` keeps both versions and the reason. That case never emits a target, so no alignment pass/fail changes. Video identity references are never fabricated.

Local rerun commands (private data required; reuse completed records rather than rebilling them):

```sh
node --conditions=source evals/datasets/private/appliance-multimedia-2026-11-03/check.mjs --check
python3 evals/datasets/private/appliance-multimedia-2026-11-03/score.py
```

The interrupted invocations used the pinned local toolchain:

```sh
env PATH="$HOME/.local/share/fingerpost/node-tools/node_modules/.bin:$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node --conditions=source evals/datasets/private/appliance-multimedia-2026-11-03/check.mjs
env PATH="$HOME/.local/share/fingerpost/node-tools/node_modules/.bin:$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node --conditions=source evals/datasets/private/appliance-multimedia-2026-11-03/check.mjs --only=tv-01,tv-02
```

Both final poll results contain `exit_code:143` and empty new output. The retained completed sample output and partial request records precede that termination; they are not replaced with fabricated response bodies. PTY continuation preserves the cumulative request counts and does not rerun completed cases.

This turn changes diagnostics/evidence only; runtime sources and dependency pins are preserved. The preceding733-case TypeScript/typecheck/build result is historical evidence from the immediately preceding repair, not a fresh full-suite run during this media check. No phone acceptance, commit, push, deployment or release is claimed. The final live batch verifies that the private `.env` bytes remain unchanged.

## Next coding work

1. Improve acquisition of the actual flat control surface; an LCD-only mask and a whole three-dimensional appliance outline both fail the intended job in different ways. Retain safe refusal when no usable plane exists.
2. Validate that a named target is the physical tappable area rather than its nearby printed caption. Reproduce the displaced-box case with synthetic regression data and evaluate changes on independently labelled flat-touchscreen photos, not sample-specific coordinate offsets.
3. Prevent unsupported actuation from being treated as a pressable button. The knob negative is a counterexample that must remain in diagnostics; generic fuzzy action matching is not proof of a printed control label.
4. Keep the inconsistent remote/PIN classification as a stress case without weakening real PIN/privacy gates. Physical-button remotes remain outside the locked MVP scope.
5. After local quality improves and the user connects a phone, verify real camera framing, fingertip alignment, speech/tone directions and an actual press/verification. Retain all unfinished quality, latency, safety, cloud and release gates.

## Public sources and derivative licenses

Photos are resized; result overlays add diagnostic annotations. Each derivative retains its source license. No author's endorsement is implied.

- washer-01: LUIAHM GEEAH, [source](https://commons.wikimedia.org/wiki/File:HK_ARISTON_washing_machine_control_panel_March_2021_SS2_01.jpg), [CC BY-SA4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- washer-02: OnionBulb, [source](https://commons.wikimedia.org/wiki/File:Heran_HWM-1311_control_panel_20190817.jpg), [CC BY-SA4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- ac-01: Lee Haywood, [source](https://commons.wikimedia.org/wiki/File:Air_conditioning_remote_(4141300928).jpg), [CC BY-SA2.0](https://creativecommons.org/licenses/by-sa/2.0/).
- ac-02: Nameless245, [source](https://commons.wikimedia.org/wiki/File:Daikin_ARC480A48_remote_control.jpg), [CC BY4.0](https://creativecommons.org/licenses/by/4.0/).
- tv-01: © Raimond Spekking via Wikimedia Commons, [source](https://commons.wikimedia.org/wiki/File:Television_remote_control_-_unbranded-9333.jpg), [CC BY-SA4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- tv-02: espensorvik, [source](https://commons.wikimedia.org/wiki/File:Remote_Control,_Television_-_TV-controller.jpg), [CC BY2.0](https://creativecommons.org/licenses/by/2.0/).
- microwave-01: Easysayg, [source](https://commons.wikimedia.org/wiki/File:Control_panel_on_an_open_microwave_oven_(125wiki).jpg), [CC BY-SA4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- microwave-02: Santeri Viinamäki, [source](https://commons.wikimedia.org/wiki/File:LG_Microwave_oven.jpg), [CC BY-SA4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- Microwave video: Erik Pålsson; photo/recording Helena Törnqvist, [source](https://commons.wikimedia.org/wiki/File:A_Whirlpool_Microwave_from_2015.webm), [CC BY3.0](https://creativecommons.org/licenses/by/3.0/).
- Washing-machine video: Erik Pålsson; photo/recording Helena Törnqvist, [source](https://commons.wikimedia.org/wiki/File:A_white_washing_machine_manufactured_by_Husqvarna_in_the_1990s.webm), [CC BY3.0](https://creativecommons.org/licenses/by/3.0/).
