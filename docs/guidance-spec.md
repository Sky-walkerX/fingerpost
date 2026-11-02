# Guidance spec v1

This spec defines how the device turns camera frames and server targets into finger guidance. It is platform-neutral, so the Android app implements it now and a future iOS or glasses client can reimplement it exactly. Every number here is an **initial value**. Evals and tester sessions tune them, and any change is recorded here with the reason.

## 1. Coordinate frames

| Frame | Units | Origin / axes |
|---|---|---|
| Image | pixels of the analysis frame (default 1280×720) | top-left; x right, y down |
| Screen | normalized `u, v ∈ [0,1]` | top-left corner of the screen *as its content reads upright*; u right, v down |
| Iso-screen | screen-height units | `x = u · aspect`, `y = v`, where `aspect = screenWidth / screenHeight`. Distances are measured here so that left/right and up/down count equally. |
| Speech | words | "up/down/left/right" for upright screens, "forward/back/left/right" for flat screens (§6) |

**Homography `H`** maps image → screen. It is computed from the four screen corners (TL, TR, BR, BL) in image pixels:
- The corners come from the server (`layout.screenQuad`, derived from the SAM 3.1 screen mask) or from the on-device contour fallback.
- Corner order follows the content orientation the server reports (`layout.rotation ∈ {0, 90, 180, 270}`).

## 2.0 Local screen-quad estimate (framing, before any upload)
Framing needs a quad without a server round trip. Candidates, scored per frame at 10 Hz on a downscale fitted inside 640×360, preserving aspect ratio in portrait and landscape without padding or stretching:
1. **OpenCV contour:** Canny → `findContours` → `approxPolyDP` (ε = 2% of perimeter) → convex 4-gons covering 8–90% of the frame.
2. **Content bounds:** the convex hull of ML Kit OCR boxes plus bright regions (Otsu threshold on the V channel), expanded 6%. This covers black-glass cooktops and panels with weak edges.

Rules:
- The best candidate must be stable for 10 frames before the first `full` keyframe is sent.
- The server's SAM quad (`layout.screenQuad`) replaces the estimate as soon as it arrives.
- If no candidate is stable within 4 s, send one full frame anyway and let SAM find the screen.

## 2. Screen tracking (every frame)
**Focus/exposure (initial value):** while the estimated quad is stable, meter AF and AE at its centre through the preview's image-to-view transform. Auto-cancel and refresh after 5 seconds; a newly stable quad can meter immediately. Unsupported metering leaves camera tracking running.

1. **Features:** Shi–Tomasi corners inside the screen quad, minus the hand's bounding box dilated by 15%. Keep at most 200 points, re-detected whenever fewer than 40 remain.
2. **Track:** pyramidal Lucas–Kanade, 3 levels, 21×21 window.
3. **Update H:** frame-to-frame homography by RANSAC with a 3 px reprojection threshold. **Valid** only with at least 12 inliers and a corner displacement under 25% of quad size.
4. **Re-anchor** to the server quad whenever a keyframe result arrives. The keyframe's capture-time H is used to carry server polygons into the current frame.
5. **States:**
   - A new local/server anchor remains **ACQUIRING** until an optical-flow update passes the existing ≥12-inlier validation. It must not be displayed as valid `TRACKING` or supply a usable H before that check. This is initialization, not evidence that the desired appliance/screen has been identified.
   - `TRACKING`;
   - `DEGRADED`: fewer than 12 inliers for 5 or more consecutive frames; the last good H is kept and the cue "hold the phone steady" is spoken;
   - `LOST`: more than 1 s in DEGRADED; go back to FRAMING.

## 3. Fingertip
- **Source:** MediaPipe HandLandmarker in LIVE_STREAM mode, running on a 640×480 downscale. Uses landmark **8** (INDEX_FINGER_TIP) and **7** (INDEX_FINGER_DIP).
  - Preserve the upright frame's aspect ratio with centered black padding inside 640×480; undo that padding when mapping landmarks back into upright frame pixels.
  - **Detector configuration (initial values):** track up to 2 hands; minimum detection, model-presence and tracking confidences are each 0.5. These detector thresholds do not replace the guidance-validity threshold below.
- **Pad point**, compensating for the finger touching with its pad rather than its tip:
  - `d = normalize(p8 − p7)`;
  - `pad = p8 − 0.25 · |p8 − p7| · d`.
- **Validity:** hand presence ≥0.6, and landmark 8 inside the image.
  - With several hands, use the one whose landmark 8 is nearest the target. Ties go to the `handedness` setting.
- **Filter:** a One Euro filter on the screen-space `(u, v)` with `minCutoff = 1.0 Hz`, `beta = 0.007`, `dCutoff = 1.0 Hz`.
- **Landmark freshness (initial value):** mute guidance after 200 ms without a new hand result; repeated or older landmark timestamps do not count toward the six-frame ON test.
- **Off-screen:** if the pad maps outside `[−0.15, 1.15]` on either axis, the state is "finger off screen". The cue is "Bring your finger onto the screen" plus a direction.

## 4. Targets
- **Input:** `target.polygon` in screen space, from the SAM 3.1 mask simplified to at most 32 points. If no mask exists, the element bounding box becomes a 4-point polygon.
- **Centroid `c`:** the polygon's area centroid, or its pole of inaccessibility if the centroid falls outside, as with L-shaped targets.
- **Inner polygon:** the target shrunk by `margin = max(0.15 · min(bboxW, bboxH), 0.004)` in screen units. If shrinking would collapse it, the centroid disc of radius `0.3 · min(bboxW, bboxH)` is used instead.
- **Zones**, by the pad's position in iso-screen units:
  - `ON`: inside the inner polygon.
  - `EDGE`: inside the full polygon but not the inner one.
  - `NEAR`: within `1.5 × max(bboxW, bboxH)` of `c`.
  - `FAR`: everything else.
- **On target:** zone `ON` for **6 consecutive frames** (about 200 ms at 30 fps). Leaving needs 3 consecutive non-ON frames (hysteresis).

## 5. Error vector and cue planning
- `e = c − pad`, in iso-screen units, with magnitude `|e|`.
- **Magnitude words:**
  - `|e| > 0.30`: "a lot";
  - `0.10–0.30`: no qualifier;
  - `0.03–0.10`: "a little";
  - `< 0.03`: no speech, tone/haptics only.
- **Direction:**
  - Name the dominant axis first.
  - Name the second axis too only if its component is at least 40% of `|e|`, e.g. "up and left a little".
  - Never more than 2 axis words per cue.
- **Cadence:**
  - At least **700 ms** between guidance utterances. This also applies when GUIDE would interrupt INFO; higher STATE/SAFETY prompts do not wait for the guidance gap.
  - A queued guidance cue older than 400 ms is dropped.
  - A new cue replaces a queued one with the same priority.
- **Priorities** (higher interrupts lower; equal waits):
  1. `SAFETY`: PIN or confirmation prompts, "cloud paused". Never interrupted.
  2. `STATE`: "Found Start", "Done", errors.
  3. `GUIDE`: directions.
  4. `INFO`: explore, touch-explore names.
- **Overshoot:** if the sign of `e` on the dominant axis flips twice within 2 s, say "slow down" once, and use "a little" wording for the next 3 s.

**Settings behavior (initial values, Day 4 repair):** speech rate applies to ordinary and local PIN TTS. Normal verbosity retains the wording above; concise speaks the dominant direction and magnitude; detailed adds a localized “Move your finger” instruction. Safety/state prompts and cadence are unchanged. In chest-mount mode framing asks the user to turn/tilt their body rather than move the handheld phone; screen-relative guidance axes are unchanged. With no target, handedness selects the preferred valid hand; with a target it breaks distance ties only. Optional foreground volume-up repeats the last public cue; volume-down names the local element under a fresh finger position, without uploads or microphone activation. Key repeats are consumed without repeating the action, and hardware cues are unavailable in PIN mode.

## 6. Upright vs flat screens
The phone's gravity vector (from `TYPE_GRAVITY`) and the camera pitch decide which wording applies:
- Pitch below the horizon is `degrees(atan2(abs(gz), hypot(gx, gy)))`, so rolling the phone between portrait and landscape does not change the tilt.
- **Flat:** camera pitch more than 55° below the horizon, i.e. looking down at a cooktop or counter terminal. Use **forward/back** for the v axis: "forward" means away from the user.
- **Upright:** use **up/down**.

Screen axes are mapped to speech axes by projecting gravity into image space and comparing it with the image-space direction of the screen's v axis.
- If the screen content is rotated relative to gravity by more than 30°, as with a tilted handheld terminal, directions follow **content** axes, and the onboarding explains this once.

## 7. Tone and haptics
- **Tone**, continuous while GUIDING when enabled:
  - frequency `f = 220 · 2^(3 · (1 − min(|e| / 0.5, 1)))` Hz, which spans 220–1760 Hz;
  - stereo pan `= clamp(e_x / 0.3, −1, 1)`, so the sound sits on the side the finger should move toward;
  - in `NEAR`, the tone pulses at `4 + 8 · (1 − |e| / nearRadius)` Hz;
    - Pulse duty cycle is 50% (initial value), retaining the audio ramps at each edge.
  - in `ON`, the tone stops and the success earcon plays.
- **Audio path:** `AudioTrack` with `PERFORMANCE_MODE_LOW_LATENCY`, 48 kHz, 5 ms ramps to prevent clicks. Target: under 100 ms from frame capture to audible change.
  - **Prototype synthesis (initial values):** stereo float PCM in 240-frame (5 ms) blocks, amplitude 0.25, equal-power gains `cos((pan+1)·π/4)` / `sin((pan+1)·π/4)`. Frequency, pan and start/stop gain ramp linearly over 240 frames; phase continues across control changes. No hand or invalid tracking mutes the tone.
  - **D1-T7d prototype mapping (initial values):** with `x = tipX / frameW`, frequency uses `toneFrequencyHz(1 − x)` and pan uses `tonePan((x − 0.5) · 0.6)`. Pitch rises toward the right of the preview; this temporary horizontal test mapping is replaced by target error during closed-loop wiring.
- **Haptics:**
  - entering `NEAR`: `EFFECT_TICK`;
  - `ON`: `EFFECT_HEAVY_CLICK` twice, 120 ms apart;
  - tracking `LOST`: a single 300 ms vibration.
- **Framing earcon (initial values):** a 40 ms accessibility-stream beep at 25% tone-generator volume, at most once per 1.5 s when framing is good.
- **Success earcon (initial value):** an 80 ms accessibility-stream acknowledgement at the same volume when entering ON.
- **Mix settings:** the user sets the weights for speech, tone and haptics. Each mode can be off. Never all three: the settings UI blocks the last remaining one from being turned off.

## 8. State machine
| State | Enters when | Leaves when | Timeout → action |
|---|---|---|---|
| `IDLE` | App start, task end | Mic opens (app open, tile, shortcut) | — |
| `LISTENING` | Prompt "What do you want to press?" | Final transcript → FRAMING | 8 s → reprompt once → IDLE |
| `FRAMING` | Goal known | Quad fully in view with a 4% margin, stable for 10 frames (corner motion < 1% per frame) → keyframe sent → LOCATING | 30 s → framing tips, stay |
| `LOCATING` | Keyframe sent | `target` → GUIDING; `ask` → ASK (task intent; guide intent → LISTENING); `confirm` → CONFIRM; `layout.screenType = pin_pad`, or `payment_entry` that has a key/input element or no pay/confirm/submit button → PIN_MODE (§10.1) | 6 s → retry once → error message |
| `GUIDING` | Target known | Zone ON for 6 frames → ON_TARGET | No hand for 1.5 s → "Raise your pointing finger into view"; 45 s total → offer explore |
| `ON_TARGET` | Pad stably ON | Press evidence (§9) → VERIFYING; leaves ON → GUIDING (300 ms quiet) | 5 s → "Press now" once, then stay |
| `VERIFYING` | Press evidence | `verify.ok` → DONE or next agent step; `verify.wrong` → speak and follow the agent; `verify.nochange` → ON_TARGET once, then RETRY | 4 s → treat as nochange |
| `VERIFYING`→`AWAIT_NEXT` | `verify.ok` in task intent | `target` → GUIDING; `ask` → ASK; `confirm` → CONFIRM; `finish` → DONE or IDLE | 6 s → resend a locate keyframe once; 6 s more → "I lost track. What do you want to do?" → LISTENING (initial value) |
| `ASK` | Server `ask` | User answer sent, then a locate keyframe → LOCATING | 10 s → repeat the question once; 10 s more → LISTENING (initial value) |
| `CONFIRM` | Server `confirm` | Spoken "yes" → LOCATING; anything else → cancel the step | 15 s → cancel, "Payment not confirmed" |
| `PIN_MODE` | PIN or payment screen detected (server or local) | Keypad gone for 2 s (local) → a fresh locate keyframe (LOCATING), or DONE if the gateway finished the task meanwhile | none (user-driven) |
| `DONE` | Task finished | → IDLE after the speech ends | — |
| `EXPLORING` | `goal.ack{intent:"explore"}` → `keyframe{purpose:"explore"}` (a locate keyframe already sent counts; no second upload) | Server `say` (summary) → mic opens for "more"; a new goal's `goal.ack` → LOCATING (guide/task) or a fresh explore keyframe (explore); "touch explore" → TOUCH_EXPLORE | No summary in 6 s → one more explore keyframe; 6 s more → "I couldn't read the screen" → FRAMING. After a summary: 12 s quiet → hint once ("Say more, touch explore, or what you want to press."); 12 s more → IDLE (initial values, 2026-11-02) |
| `TOUCH_EXPLORE` | "touch explore" while EXPLORING with a layout on the phone | Abort (session button) → IDLE; PIN gate → PIN_MODE, and its exit returns to EXPLORING | none (user-driven); no uploads, mic closed, tone off |

**DONE completion:** the final STATE utterance carries a completion id through the speech queue to the TTS adapter. Return to IDLE only when that utterance finishes; ignore stale or unrelated completion callbacks. Timer ticks do not substitute for speech completion.

**Framing coach:** runs every 1.5 s while in FRAMING. Checks run in this order: no quad; **too close** (quad area over 85%, checked first because such a quad always touches the 4% margin); cut off; too far (under 15%); off-centre (over 15%). This order was fixed during planning verification.
- **Direction:** the screen quad's center offset from the image center gives the direction to move the phone.
- **Distance:** quad area under 15% of the frame → "move closer"; over 85% → "move back".
- **Partly out of view:** the cue names the edge that's cut off ("the screen's left edge is cut off, move the phone left").

## 9. Press evidence (any one is enough)
1. **Simulator touch event**, relayed by the gateway to the linked session as a server message `sim.touch`. This is ground truth.
2. **Screen change:** the mean absolute difference of the rectified screen (grayscale, 160×90) exceeds **τ = 0.08** for 3 consecutive frames. Pixels inside the hand mask are excluded.
3. **Dwell plus occlusion:** for appliances that don't change visibly, ON for ≥0.8 s **and** the target region's occlusion goes above 60%, followed by release. This is weak evidence. The client sends `event{kind:"tapDetected", detail:{evidence:"dwell"}}`, and the server may ask the user to confirm. Other evidence values are `sim` and `screen_change`.

## 10. PIN mode (local only)

### 10.1 Pre-upload gate (runs on every frame before it may be uploaded)
The frame is **blocked** and PIN mode is entered if either holds:
- **Digit grid:** on-device OCR finds at least 7 distinct single-character digit tokens (0–9) inside the screen quad, and their centers fall into a 3- or 4-row × 3-column grid. Row clustering uses a tolerance of 0.6 × the median token height; column clustering uses 0.9 × the median token height. Both are distances in **pixels**: tokens are normalized per axis, so the column tolerance in normalized width units is 0.9 × median height ÷ (width ÷ height of the token space in pixels). Without this a wide screen merged neighbouring key columns (fixed 2026-11-02, C4-4).
- **PIN text:** OCR text matches `/\b(PIN|enter pin|पिन|clave|NIP|passcode|password|contraseña|पासवर्ड)\b/i`.
- **Fail closed (added Day 3):** a word that is one digit plus up to 4 letters ("2ABC") counts as that digit, OCR tokens holding several words ("1 2 3") are split evenly across their box, and the 3 grid columns are the column clusters holding at least 2 digits, so stray single digits elsewhere on screen can't hide a keypad.

The server's `screenType ∈ {pin_pad, payment_entry}` is a second layer for missed cases. A `payment_entry` layout counts only when it takes input (a `key` or `input` element) or offers no pay/confirm/submit button: an amount summary with a Pay button is where the CONFIRM turn happens, so it must stay online (initial value, 2026-11-01). The ≥98% recall release gate measures **local gate OR server**, and the local gate alone is reported too.
- **On entry:**
  - Stop keyframe uploads and stop the mic stream (`audio.end`).
  - Send `event{kind:"pinModeEntered"}`, which carries no content.
  - The UI shows "Cloud off".
- **Audio route:** must be wired, Bluetooth A2DP, or BLE audio. Otherwise say "Connect earphones for PIN help" and pause; nothing is announced over the speaker.
- **Layout announcement:** "phone layout", "calculator layout", or "keys are scrambled". It comes from the last layout plus on-device OCR (digits 0–9 inside the keypad region).
- **Route enforcement (initial values, Day 4 repair):** use an installed offline TTS voice for synthesis without system playback. Discard synthesis output through `/dev/null`; transient PCM goes only to a dedicated AudioTrack. Prime with silence at zero volume and wait at most 500 ms for its actual routed device to match the selected earphones; refuse unknown, speaker or duplicated routes (all routed devices are inspected where supported). Recheck on routing callbacks and before each at-most-5-ms PCM write, muting, flushing and closing on loss. Accept PCM16 mono/stereo only; unsupported formats/voices/routes remain silent. No audio file, content log or telemetry buffer is created. Physical disconnect/route acceptance remains required.
- **Digit under finger:** announced when it changes, debounced 150 ms, at INFO priority, through earphones only. Digits are never logged and never stored. Speech audio isn't recorded. A key counts as under the finger's pad within 1.5 digit-heights of its OCR label box (initial value, 2026-11-02). Digits use a separate on-device TextToSpeech, not the shared speech queue; if the earphones disconnect, digit speech stops at once and the app says "Earphones disconnected. Connect earphones for PIN help."
- **Exit:** fewer than 5 digit tokens in the keypad region for 2 s. Then resume normal mode and request a fresh keyframe.

## 11. Two-source agreement (safety)
- **Text targets:** the server label and the on-device OCR text found inside the target bounding box must match. Both are normalized (lowercase, NFKC, punctuation stripped), and the match needs a token-set ratio ≥ 0.8.
  - **On mismatch:** say "I think this is {label}, but I'm not sure". Payment-role targets require a confirm.
- **Icon-only targets:** server confidence must be at least 0.75. Otherwise speak the uncertainty.
- **Roles `pay | confirm | submit`:** the device refuses to guide unless the server has a matching `confirm` that the user accepted in this session. Defense in depth: the gateway's policy layer enforces the same rule.

## 11a. Explore and touch-explore
- **Summary:** the gateway reads the screen by region (≤ 3 sentences, ending "Say more for details."); "more" reads the next region. The device only sends the explore keyframe and speaks the `say` at INFO priority.
- **Touch-explore (local only):** over the last layout, the element under the finger's pad (§3 pad point, through the tracked homography) is named once it has stayed under the pad for **150 ms**, and not again until the finger leaves it. The smallest polygon under the pad wins. Plain `text` elements are prefixed ("Text: Total ₹149") so they aren't mistaken for controls.
- **Edge earcon (initial value, 2026-11-02):** leaving an element plays a 30 ms `TONE_PROP_BEEP2` on the accessibility stream at 25% volume, immediately and without speech.
- **Command:** "touch explore" (hi "टच एक्सप्लोर", es "exploración táctil"); plain "explore" is the summary.

## 11b. Offline basic mode
- **Starts on:** `mode{offline}`, `error{cloud_paused | quota_exhausted}`, `ready.flags.cloudEnabled = false`, or no gateway connection for **5 s** (initial value, 2026-11-02). It says "Basic mode: text buttons only." (after the gateway's reason, if any) and restarts the session if one was running.
- **Speech:** Android `SpeechRecognizer` with `EXTRA_PREFER_OFFLINE`, one utterance at a time, language from settings (en-US, hi-IN, es-ES). Transcripts are never logged. If the phone can't recognise speech offline, say so once.
- **Locate:** the goal (filler words removed, same list as the gateway) is matched against on-device OCR tokens inside the screen quad with the gateway's `resolveByText` rules: an exact name wins (two exact → ask which); otherwise token-set ratio ≥ 0.8, and a runner-up within 0.05 → ask which. Tokens with no letters (digits, prices, PIN keys) are never targets. The token's box is the target polygon.
- **Icons:** a goal naming an icon (wifi, power, settings, back arrow, home, volume, and their hi/es words) says icons need the cloud, unless that exact word is printed on the screen.
- **No match:** "I can't find {goal}. I can see …" with up to 5 readable words.
- **Verify:** no upload. Screen-change evidence → "Done."; dwell alone → "I think that pressed it." (§9 weak evidence).
- **Nothing is uploaded** and no session events are sent. The local PIN gate (§10) still runs. When the cloud returns, the current session finishes in basic mode and the next one is online.

## 11c. On-device layout cache (instant re-lock)
- **What is kept:** for guide goals on ordinary screens, the gateway's layout as element id, label, role and polygon (no `text` elements, no images). Never for `pin_pad`, `payment_entry` or `confirm` screens, or any sensitivity other than `none`. At most **50** screens, least recently used dropped first; on this phone only; "Clear saved screens" in settings empties it.
- **Key:** a 4-bit aspect bucket (16 log-spaced buckets over 1/3 … 3) plus a 60-bit SimHash of character trigrams of the OCR words inside the screen quad; words with digits or currency symbols are dropped, so prices and order numbers don't change it. A lookup hits the nearest entry within Hamming **3** on the SimHash bits and at most one aspect bucket away (initial values, 2026-11-02).
- **Re-lock:** when a guide-intent locate keyframe is sent, a hit is resolved with the gateway's `resolveByText` rules. It guides at once only for a plain control (not pay/confirm/submit, icon or text) whose label fresh OCR inside its box agrees with (§11). OCR disagreement drops the entry. The keyframe still goes to the gateway: its target confirms the re-lock, or replaces the target (and the entry) if it names another element.
- **Target:** "Found …" in < 0.8 s on a known screen.

## 12. Performance budget (mid-range Android, 2021 or newer)
| Stage | Budget |
|---|---|
| Hand landmarks (GPU, 640×480) | 15–25 ms |
| KLT + RANSAC | ≤ 5 ms |
| Fingertip map + filter + zones + cue plan | ≤ 1 ms |
| Audio update | ≤ 1 ms (separate thread) |
| End-to-end, frame to cue | ≤ 100 ms |

**Under thermal throttling:**
- First, drop the hand model to every other frame and interpolate.
- Second, drop analysis to 15 fps.
- Say nothing about either unless guidance actually suffers.

## 13. Replay tests
The guidance core is pure Kotlin (`core:guidance`). It is tested with **replay files**: JSON sequences of `{t, quadImg[4], landmarks7_8, handPresence, gravity}` plus a target polygon. They contain no images. Each replay asserts:
- the emitted cue sequence;
- the zone transitions;
- the time to ON.

Replays are recorded from real sessions (metadata only) and from synthetic generators: straight approach, overshoot, jitter, lost tracking.
