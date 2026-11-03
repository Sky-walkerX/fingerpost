# Fingerpost — Design (v1.0, approved 2026-10-27)

## Context
Fingerpost won the round-3 idea research (35/40). The user now wants it planned as a **production-grade, launchable product**, not a hackathon toy. That means good architecture and system design, built over 7 high-output days. Every product decision below came from the user in this session. Technical defaults I picked are listed separately under "My calls" so the user can veto them.

**What the product does:** a blind or low-vision person points an Android phone at any touchscreen (appliance panel, kiosk, ticket machine, card terminal) and says what they want. Fingerpost guides their finger to the right spot with speech, tones and vibration, checks that the press worked, and walks them through multi-step tasks. During PIN entry, camera frames never leave the phone.

Today is Day 1: Tue Oct 27, 2026. Deadline: Thu Nov 5, 7:30 AM IST.

---

## 1. Decisions locked with the user

| Topic | Decision |
|---|---|
| Team | 3 people. The user floats across all lanes as lead/integrator. Lanes: **A** Android app + guidance; **B** backend + AI pipeline; **C** quality (evals, testers), web, video. C can start Android work late in the week if needed. |
| Platform | **Android-first native (Kotlin)**. iOS comes after launch (no $99 Apple account). |
| Devices | iPhone 17 (used as a small simulator screen), an Android phone (model TBC), an **Android tablet** (the kiosk simulator), M5 laptop. No Meta glasses. |
| Glasses | Phone only. The code is glasses-ready: a `FrameSource` interface plus the DAT Mock Device Kit (stretch goal). |
| Build window | 7 build days, **Oct 27–Nov 2**. Nov 3–4: video, X post, submission. |
| Launch bar | **Public beta**: a signed APK on GitHub Releases, plus a landing page with waitlist at **fingerpost.web.app**. |
| Money | **Free and open source, grant-funded.** $0 budget. |
| Running cost | Per-user **daily free quota** plus a **global spend kill switch**. |
| Backend | **TypeScript (Node)** on the user's **GCP**. |
| Data | **Firestore + Firebase** services (Anonymous Auth, Remote Config, Crashlytics, Hosting). |
| Open weights | **Glimmer as "private mode"** on Modal (targets the $10k open-weights prize). |
| Privacy | **Zero retention by default.** Opt-in "donate this session" after failures, with faces and cards blurred and deletion after 90 days. |
| PIN / payment | **PIN entry is guided on-device only.** Cloud and mic are off during it; earphones are required. |
| Guidance feel | **Blend** of short speech, a closeness tone and haptics, tunable in settings. Testers set the defaults. |
| Phone hold | **Handheld or chest mount**, with a framing coach for both. |
| Languages | **English, Hindi, Spanish.** |
| Testers | None yet. Outreach starts today. |
| Real screens | Home appliance touch panels. Kiosks only as tablet simulator replicas. |
| Demo video | Home appliance plus simulator. No public kiosk. |
| Gate | **Committed to Fingerpost.** The Oct 29 technical check (8 of 10 attempts under 15 s) only triggers a scope cut, not a pivot. |
| License | **Apache-2.0** |
| v1 features | Core guide, **multi-step task agent**, **explore mode**, **kiosk memory**, **offline basic mode**. |
| Cut order | If time runs short: offline basic mode → kiosk memory → explore (keep the summary only) → agent (cut last). **Private mode is protected in a slim form** (Glimmer plus on-device OCR geometry; self-hosted SAM is a stretch goal). Of the platform work, **only Spanish may slip** past Nov 2. Dev/prod split, dashboards and alerts, the load test, the threat model and Key Attestation all stay in. |
| Gate misses | **Safety gates are hard; the rest are soft.** The public APK is held only if PIN/payment detection recall is below 98% or any wrong tap on a pay element occurs. Other misses ship as "beta" with a public known-issues list. |
| Name | Fingerpost, at fingerpost.web.app. |
| X / viral | User's own X account plus a new @fingerpost (or @fingerpostapp) account. |
| Starting a task | The app opens already listening; Quick Settings tile and home-screen shortcut; "Hey Google, open Fingerpost". |

## 2. Corrections to things I said earlier
- **Firebase App Check with Play Integrity won't work.** It fails for sideloaded APKs (the app isn't recognised by Play). Replacement: **Android Key Attestation**, which is free, hardware-backed, and verified server-side with Google's roots, our package name and our signing-cert digest. Per-uid, per-IP and spend limits back it up.
- **Meta has no TTS model.** All speech uses on-device Android `TextToSpeech`.
- **SAM 3.1 on the Model API is request/response** (an image or a short clip), not a live stream. So the 30 fps loop must run on the phone, and cloud models run on keyframes.
- **Google Play production isn't reachable by Nov 2.** New personal accounts need a 12-tester, 14-day closed test. GitHub Releases is the channel; Play ($25) comes later.
- **India access is fine for the core:** the Geographic Use Policy (Oct 12, 2026) restricts only Muse Image in India. Spark, SAM 3.1 and Voice Transcribe are allowed, so ADR-0003 can pick either region on latency alone.
- **Glasses SDK limits:** camera streaming is production-OK, but glasses-mic audio streaming is experimental and not publishable. When glasses come, voice still goes through the phone.

---

## 3. Product spec

### 3.1 Users and the job
- **Primary user:** a blind or low-vision adult on Android with TalkBack.
- **The job:** "Get my finger onto the right control on a flat touchscreen, know it worked, and never expose my PIN."
- **Screens in scope:**
  - home appliances (induction cooktop, microwave, washing machine, AC);
  - self-order kiosks;
  - ticket machines;
  - check-in kiosks;
  - card/POS terminals.
- **Out of scope:**
  - medical devices;
  - physical-button keypads, which already have tactile access;
  - wayfinding *to* the kiosk;
  - general scene description;
  - remote sighted helpers.

### 3.2 Modes
1. **Guide (core):** one target. The user says "press Start", gets guided, and the press is verified.
2. **Task (agent):** a multi-step goal across screens, e.g. "order a medium cola".
   - It asks questions ("Which size?").
   - It **requires a spoken "yes" after reading the amount** before any pay or confirm press.
   - It recovers when the user goes back.
3. **Explore:**
   - (a) "What's on the screen?" gives a spoken summary by region, at most 3 sentences, then "say more".
   - (b) **Touch-explore:** as the finger slides over the physical screen, the app speaks the element under it. This runs locally and instantly.
4. **PIN (automatic):** triggered **on the device, before upload**, by a local keypad/payment detector (guidance-spec §10.1). Server `screenType` `pin_pad` or `payment_entry` is a second layer. So even the first PIN-pad frame stays on the phone.
   - Uploads and the mic stop.
   - The app checks the audio route and needs earphones (wired or Bluetooth).
   - It announces the layout ("phone layout, 5 in the centre").
   - It announces the **digit under the finger**, computed locally from the last layout plus on-device OCR.
   - It never guides to digits the user speaks; the user never says their PIN.
   - It exits when the keypad disappears, detected locally.
5. **Private:** a user toggle, plus automatic when the server marks `layout.sensitivity` as `financial` or `identity` (for later frames of that screen).
   - For a guaranteed-private session, the user switches private mode on before pointing the camera.
   - Parse, plan and verify run on **Glimmer on our Modal GPU**. Nothing goes to the Meta API.
   - Geometry comes from on-device OCR boxes and edge snapping.
6. **Offline basic:** no network or the kill switch is on.
   - On-device ASR plus ML Kit OCR, fuzzy-matched to the goal, drives the same guidance engine.
   - Text targets only; it says so for icons.
   - Doubles as the graceful fallback when the budget runs out.

### 3.3 Core flow (Guide)
1. **Open:** the camera starts and TTS asks "What do you want to press?" Voice Transcribe streams through the gateway. If it fails, the on-device recognizer takes over.
2. **Framing coach:** until the screen quad is stable and fully in view: "Move the phone right… back a little… hold still". A soft tick plays when framing is good.
3. **Locate:**
   - Try kiosk memory first. If there's no hit, Spark parses the layout and SAM 3.1 refines the target mask.
   - Speak the result: "Found Start, bottom right."
   - If two elements match, ask: "I see Start and Quick start. Which one?"
   - If nothing matches, list what is there.
4. **Guide:** the index fingertip is tracked at 30 fps, and the blended cues bring it to the target. On target: a strong vibration and "Tap."
5. **Verify:**
   - Detect the press: dwell time, a change on the screen, and on the simulator a real touch event.
   - Take a keyframe and check it against the expected outcome. Then say "Done", or "Screen didn't change, press a bit firmer", or "That was Menu, going back".

### 3.4 Guidance language
- **Frame of reference:** the screen plane, aligned to gravity using the phone's orientation sensor.
- **Speech:**
  - Direction plus size, in screen-height units:
    - over 0.30: "up a lot";
    - 0.10–0.30: "left" (no qualifier);
    - 0.03–0.10: "a little";
    - under 0.03: tone and haptics only.
  - guidance-spec §5 is authoritative.
  - At least 700 ms between utterances; stale cues get interrupted.
- **Tone:** pitch rises as the finger gets closer; stereo pan follows left/right offset. Generated with low-latency `AudioTrack` at under 100 ms end to end.
- **Haptics:** a light tick when a boundary is crossed; a strong pattern on target.
- **Settings:**
  - mix (speech, tone, haptics);
  - speech rate;
  - verbosity;
  - handedness;
  - hold mode;
  - language.

### 3.5 Safety rules (enforced in code, not only in prompts)
- **Two-source agreement before guiding to a text target:** Spark's label must match on-device OCR. Icon-only targets require the SAM and Spark confidence thresholds and get spoken uncertainty ("I think").
- **Irreversible actions:** before guiding to pay, confirm or submit, the app reads the summary and amount, then waits for an explicit "yes". Without it, nothing happens.
- **PIN:** never sent, spoken, logged or stored. PIN-pad detection must reach recall ≥98% on the eval set (a release gate).
- **Never a confident wrong answer:** at low confidence the app says it isn't sure and offers explore mode.
- **Disclaimer:** "assistive aid, double-check important actions". No medical devices.

### 3.6 Accessibility of the app itself
- **TalkBack-first.** The session screen is one large action. Every control is labeled.
- **Hardware keys:** while the app is in the foreground, volume keys can repeat the last cue or ask "what's under my finger". Optional, off by default.
- **Self-voicing:** the app manages its own TTS queue and uses `announceForAccessibility` only for state changes, to avoid double speech.
- **Low vision:**
  - high contrast and large text;
  - a dark default theme;
  - a live preview with a thick outline on the target and the fingertip.
- **Onboarding:** a voice tutorial, then a practice target on the simulator page, which opens on any laptop.

### 3.7 Non-goals and anti-goals
- **Non-goals for v1:**
  - an iOS app;
  - real-glasses support;
  - document reading;
  - scene description;
  - physical keypads;
  - Play or App Store listings.
- **Anti-goals (failure even if it "works"):**
  - guiding confidently to the wrong payment button;
  - any PIN frame leaving the device;
  - a demo that only works on the simulator;
  - drifting into a scene describer, which is a crowded pile.

---

## 4. System architecture

```
 ┌─────────────────────────── Android phone ("body", real-time, safety-local) ───────────────────────────┐
 │ FrameSource (PhoneCamera | Glasses/DAT-mock)                                                            │
 │   └─ CameraX 1280x720@30 ─┬─ HandLandmarker (MediaPipe, GPU) → fingertip (lm 8) → OneEuro filter        │
 │                           ├─ ScreenTracker (OpenCV KLT + RANSAC homography, hand region masked)        │
 │                           ├─ ML Kit OCR (Latin + Devanagari) + Face detect (for blur)                   │
 │                           └─ Keyframer → rectified screen crop JPEG (only the screen leaves the phone) │
 │ GuidanceEngine (state machine) → AudioEngine (TTS queue, tone synth) + Haptics                          │
 │ SafetyGuard (PIN/payment mode, confirm gate, two-source check)   LocalLayoutCache (kiosk memory hits)    │
 │ SessionClient (OkHttp WebSocket, fp.v1 protocol)   Settings (DataStore)   Crashlytics / RemoteConfig     │
 └───────────────────────────────┬──────────────────────────────────────────────────────────────────────────┘
                                 │ WSS: JSON control + binary (PCM16 audio, JPEG keyframes)
 ┌───────────────────────────────▼──────── Cloud Run: gateway ("brain", TypeScript/Fastify) ────────────────┐
 │ auth (Key Attestation → session JWT, Firebase anon uid)  quota + spend ledger + kill switch              │
 │ session hub (WS) → agent loop (Spark tools) → parse pipeline (memory → Spark → SAM refine → cross-check) │
 │ ASR relay (Voice Transcribe realtime)  model router (Meta API | Modal Glimmer | fallback)  prompts/v*    │
 │ kiosk memory (fingerprint, LSH)  telemetry (pino → Cloud Logging, OTel → Cloud Trace)  donations (GCS)   │
 └──────┬───────────────────────────┬───────────────────────────────┬──────────────────────────────────────┘
        │ api.meta.ai/v1            │ Modal (vLLM, OpenAI-compatible)  │ Firestore / Remote Config / GCS / Secret Manager
   Spark 1.3 · SAM 3.1 ·        Glimmer 30B (private mode)
   Voice Transcribe
 Firebase Hosting: fingerpost.web.app (landing, install guide, privacy, waitlist) + /sim (kiosk simulator on tablet)
```

**Why the brain sits on the server:**
- Sideloaded APKs don't auto-update, so prompts, policies and the agent can be fixed without shipping a new APK.
- API keys and quotas stay server-side.
- The future iOS and glasses clients reuse the same brain.

**Why the body sits on the phone:**
- Guidance must stay at 30 fps and under 100 ms.
- PIN and safety must work with no network.

### 4.1 Session protocol `fp.v1`
JSON text frames, plus binary frames shaped `[u32 headerLen][JSON header][payload]`. The schemas live in `packages/protocol` (zod → JSON Schema). Shared **golden fixtures** are parsed by both the TS and Kotlin tests.
- **Client → server:**
  - `hello{appVersion, locale, mode, privacy, caps}`
  - `audio` (PCM16 16 kHz) and `audio.end`
  - `goal{text}` (used by the on-device ASR path)
  - `keyframe{id, kind: full|screen, quad, ocrTokens[], ts}` plus a JPEG
  - `event{tapDetected|screenChanged|targetReached|lost|userCancel}`
  - `answer{text}`
  - `abort`
- **Server → client:**
  - `transcript{partial|final}`
  - `layout{fingerprint, screenType, language, elements[{id,label,role,state,polygon,textNorm}]}`
  - `target{elementId, polygon, confidence, say}`
  - `say{text, priority}`
  - `ask{question, options[]}`
  - `confirm{summary, amount}`
  - `expect{description}`
  - `verify{ok|wrong|nochange, say}`
  - `mode{normal|pin|private|offline}`
  - `quota{tasksLeft}`
  - `error{code, retryable, say}`
- **Versioning:** protocol versions are checked in `hello`. Remote Config `min_supported_version` forces upgrades.

### 4.2 Parse pipeline (per keyframe, on the gateway)
0. **On the device, before any upload:** the local PIN/payment gate (guidance-spec §10.1) blocks the frame and enters PIN mode. Framing uses a local screen-quad estimate (guidance-spec §2.0), so no server round trips are needed before the first keyframe.
1. **Kiosk memory lookup.** Fingerprint = SimHash of normalized stable OCR tokens, aspect bucket and grid signature. A hit (Hamming ≤3, trusted) returns the layout in about 300 ms.
2. **Miss:** Spark 1.3 vision with a JSON schema returns:
   - elements with label, role, normalized bounding box and state;
   - `screenType` (`menu|form|confirm|payment_entry|pin_pad|appliance|…`);
   - language, plus translations into the user's locale.
3. **SAM 3.1:**
   - Box prompt from Spark's box for the target → precise mask → polygon (Douglas-Peucker, ≤32 points).
   - On the first `full` frame, a text prompt "touchscreen display" gives the screen quad.
   - SAM calls run in parallel with Spark wherever possible.
4. **Cross-check:** compare Spark labels with device OCR tokens to get a consistency score, which feeds the safety rules.
5. **Latency targets:** first parse p50 ≤2.5 s; re-target on a known layout ≤1.2 s; memory hit ≤0.8 s.

**Privacy:**
- The first full frame is face-blurred on the device.
- After that, only the **rectified screen crop** is uploaded (about 1024 px, JPEG q80), never the surroundings.

### 4.3 Agent loop (gateway, Spark tool calling, streaming)
- **Tools:**
  - `get_layout()`
  - `find_element(description)`
  - `guide_to(element_id, why)`
  - `wait_for_screen_change(expected)`
  - `ask_user(question, options)`
  - `confirm_with_user(summary, amount)`
  - `say(text)`
  - `go_back()`
  - `finish(result)`
- **How tools run:** a tool becomes a command sent to the device, and the server awaits the device's event.
- **Policy layer outside the model:**
  - `guide_to` on an element with role `pay|confirm|submit` is **blocked** until `confirm_with_user` returns yes.
  - Step budget: 20 steps or 5 minutes.
  - Loop detection: the same screen 3 times.
- **State:** goal, screen history (layout summaries only) and steps taken. Held in memory, pinned to the WS. On reconnect the client sends a state digest.

### 4.4 Model router and fallbacks
- **Public appliance grounding repair (2026-11-04):** the Meta port can inspect a transient contextual crop for the selected control (`ground-control.v1`). Its structured result distinguishes pressing from turning/sliding and maps the corrected area back into the original frame before SAM refinement. Control-panel masks precede whole-appliance fallbacks; enclosing contour edges preserve rounded-panel controls. Sharp performs bounded asynchronous JPEG preparation in the gateway; no new upload endpoint or persistent image store is added. Glimmer/private ports never fall back to this public capability. See guidance-spec §§2.0,4 for bounds and refusal behavior.
- **Normal mode:** Meta API: Spark 1.3 (fallback 1.2), SAM 3.1, Voice Transcribe in `ENDPOINTING` mode.
  - `languageBias=[en,hi,es]`.
  - `keywords` = labels on the current screen, which biases ASR toward on-screen words. Provider input bound observed 2026-11-03: trim labels, omit blank hints and hints over 30 Unicode characters, then select at most 50. Do not truncate a long label into a different term; oversized hints must not reject the whole speech connection. Keywords bias recognition; they do not guarantee an exact transcription.
- **Private mode:** Glimmer on Modal, with on-device OCR geometry. SAM 3.1 open weights on the same GPU is a stretch goal.
- **Meta outage:** retries with jitter, then a circuit breaker. Then Glimmer if it's warm, then offline basic mode. Every failure comes with a spoken message.
- **Prompt caching:** static system prompts first; cached input costs $0.15/M vs $1.25/M.
- **Contributor mode:** never used, because frames are user surroundings.

### 4.5 Quotas, spend and the kill switch
- **Spend ledger:** every model call logs cost units: tokens, SAM images/frames (min 50 frames per video call), ASR seconds. It's written to Firestore `spend/{date}/shards/{n}`.
- **Kill switch:**
  - When the daily cap is reached, Remote Config `cloud_enabled=false`. The gateway caches this for 30 s.
  - Clients switch to offline mode and say: "Cloud features are paused today; basic mode still works."
  - A GCP Billing budget alert → Pub/Sub → a Cloud Run job flips the same flag.
- **Defaults (in Remote Config):**
  - 30 tasks per user per day;
  - a hackathon-period cap of $12/day (fits within the $150 credits);
  - a post-hackathon cap set by grant funding.
- **Cost model (to be re-measured on Day 1):**
  - About $0.02 for a single-target task.
  - About $0.08–0.10 for a 5-step task.
  - ASR about $0.0015 per 30 s.

### 4.6 Security
- Meta and Modal keys live in Secret Manager; there are **no keys on the device**.
- Least-privilege service accounts; GitHub Actions deploys through Workload Identity Federation (no JSON keys).
- **Key Attestation flow:** the app generates a hardware-backed key with a server challenge, and the gateway verifies:
  - the chain to Google's roots;
  - the revocation list;
  - `attestationApplicationId` (package plus signing-cert SHA-256).
  - It then issues a 15-minute JWT, bound to the Firebase anonymous uid.
- **Limits:**
  - per-uid and per-IP rate limits;
  - WS message rate and size caps;
  - zod validation on every message.
- **Firestore rules:** deny all client writes; clients go through the gateway.
- **Supply chain:** Dependabot, `npm audit` and Gradle dependency verification.
- Threat model doc (STRIDE-lite) and SECURITY.md.

### 4.7 Privacy
- **Frames:** processed in memory only and never stored. Meta API Standard mode (not used for training).
- **Logs:** metrics only (latencies, outcomes, mode), no content, with a 30-day TTL.
- **Donations:**
  - Per-session opt-in.
  - Faces blurred on-device (ML Kit), plus 13–19-digit card sequences found by OCR.
  - Uploaded to GCS via a signed URL, with a 90-day lifecycle delete and restricted IAM.
- **No third-party analytics.** Crashlytics only, with no PII.
- A privacy policy and data-safety page on the website.

### 4.8 Observability and SLOs (beta)
- **Telemetry:** OTel spans per model call → Cloud Trace. Structured pino logs → Cloud Logging. A Cloud Monitoring dashboard covering:
  - parse latency;
  - time-to-target;
  - success rate;
  - cost per task;
  - error rate.
- **Alerts:** error rate >5%, p95 parse >5 s, spend >80% of cap.
- **SLOs:**
  - gateway availability 99%;
  - p95 first parse ≤4 s;
  - crash-free sessions ≥99%.

### 4.9 Firestore data model
| Collection | Contents |
|---|---|
| `users/{uid}` | locale, attested, appVersion, quotaDay, tasksToday |
| `kiosk_layouts/{fp}` | screenType, aspect, elements (normalized boxes, roles, salted label hashes), lsh bands b0–b3, seenCount, salted install hashes, trust and formatVersion. **No images, uids or raw text**, including model element IDs, labels and normalized labels. |
| `spend/{date}/shards/{n}` | costMicros |
| `metrics/{sessionId}` | aggregate numbers only; 30-day TTL |
| `donations/{id}` | GCS pointers; 90-day TTL |
| `sim_events/{runId}/{eventId}` | simulator touches, for evals |
| `waitlist/{id}` | email + locale |
| `feedback/{id}` | user feedback text |

**Kiosk memory trust:**
- **Privacy repair (2026-11-03):** format 2 stores only salted label candidates, roles and geometry, before and after agreement. Two installs can see the same personal name, so agreement never permits plaintext retention. Token hashes are salted before SimHash too. A lookup reconstructs labels solely from fresh OCR that matches every stored label hash in its box, using session-local `memory-<index>` IDs. EN/HI/ES language metadata is allowlisted. Legacy records are not served and must be purged from any existing deployment before enabling the repaired store; ignoring them does not delete previously retained text.
- A layout becomes "trusted" when it's agreed by 2 or more **distinct attested installs**. Up to 5 salted SHA-256 hashes of attestation key IDs are stored per layout, never uids. Until then it's only a hint, verified against fresh OCR.
- **Repeat visits by the same user** are served by the on-device `LocalLayoutCache`: layout structure only, on the user's own phone, clearable in settings. This is what powers the demo's instant re-lock.

---

## 5. Component design

### 5.1 Android app (`apps/android`)
- **Stack:**
  - Kotlin 2.2, Jetpack Compose + Material 3, Hilt, Coroutines/Flow.
  - CameraX: `ImageAnalysis` with keep-latest.
  - MediaPipe Tasks Vision `HandLandmarker` (LIVE_STREAM, GPU), with the bundled `.task` model.
  - OpenCV 4.x (Maven), for KLT, homography and contour fallback.
  - ML Kit Text Recognition v2 (Latin + Devanagari, bundled) and Face Detection (bundled).
  - OkHttp WebSocket, kotlinx.serialization, DataStore.
  - Firebase BoM: Auth, Remote Config, Crashlytics.
  - Android `TextToSpeech`, `AudioTrack` (low latency), `VibratorManager`.
  - Meta Wearables DAT `mwdat` 1.0.1, behind `FrameSource`.
- **Modules:**
  - `app`
  - `core:vision` (hand, screen tracker, OCR, blur)
  - `core:guidance` (pure Kotlin: geometry, state machine, cue planner; no Android deps, fully unit-tested)
  - `core:audio`
  - `core:session` (protocol, WS client, auth/attestation)
  - `core:safety`
  - `core:memory` (local layout cache)
  - `feature:onboarding`, `feature:session`, `feature:settings`
  - `source:glasses` (DAT, mock)
- **Guidance state machine:** `IDLE → LISTENING → FRAMING → LOCATING → GUIDING → ON_TARGET → VERIFYING → (DONE | RETRY | ASK | CONFIRM | PIN_MODE) → …`
  - Each state has a timeout and a spoken exit.
- **Frame budget:** hand tracking 15–25 ms, tracker about 5 ms, guidance about 1 ms, all under 33 ms. The hand model runs at 640×480 and drops frames under thermal pressure.
- **Geometry:**
  - fingertip → screen coordinates through homography H;
  - parallax compensation: a fingertip-pad offset along the finger direction;
  - on target = inside the polygon shrunk by a margin, for N consecutive frames;
  - the screen tracker excludes features inside the hand's bounding box.
- **Starting a task:** opens listening; Quick Settings `TileService`; a static app shortcut; launch by app name works with "Hey Google".
- **Updates:** a check against the GitHub Releases API at startup gives a spoken prompt. Remote Config can force a minimum version. Compatible with Obtainium.
- **minSdk 29** (Android 10, which DAT requires); target SDK 36, compile SDK 37 (D1-T7b first-build correction: pinned Compose/Core libraries require API 37).

### 5.2 Gateway (`services/gateway`)
- **Stack:** Node 24 LTS, Fastify + `@fastify/websocket`, zod, OpenAI SDK (`baseURL https://api.meta.ai/v1`), `@meta-sam/parser`, `ws` (ASR relay), firebase-admin, pino, OpenTelemetry, `pkijs`/`asn1js` (attestation).
- **Directories:**
  - `src/session` (hub, state)
  - `src/agent` (loop, tools, policy)
  - `src/parse` (pipeline, SAM utilities, cross-check)
  - `src/models` (router, meta, modal, fallbacks)
  - `src/asr`
  - `src/memory`
  - `src/quota`
  - `src/auth`
  - `src/telemetry`
  - `prompts/` (versioned `.md` files, with prompt IDs recorded in telemetry)
- **Routes:**
  - `POST /v1/auth/challenge` and `POST /v1/auth/attest` (ADR 0004)
  - `GET /v1/config`
  - `WS /v1/session`
  - `POST /v1/donate` (signed URL)
  - `POST /v1/waitlist` (rate-limited, honeypot)
  - `POST /v1/sim/events` (simulator touches → Firestore + `sim.touch` relay; run-scoped token)
  - `GET /healthz`
- **Cloud Run:**
  - single region, chosen by Day-1 latency measurements (asia-south1 vs us-central1);
  - concurrency 40, min instances 0 (1 during demos and judging);
  - request timeout 3600 s for WebSockets.
- **Dev mode:** a recorded-response mock of the Meta API, so work can continue offline and CI stays cheap.

### 5.3 Private models (`services/private-models`)
- A Modal app (a small Python file, deploy config only, no business logic) serving **Glimmer via vLLM** behind an OpenAI-compatible API.
- **Quantization:** chosen by eval, following Meta's quantization guide.
- **GPU:** L40S, or A100-80GB if quality needs BF16.
- **Scaling:** scale to zero, with a 5-minute scaledown window, plus a keep-warm toggle for testing and demos.
- Proxy-auth token; request logging off.
- **Prize evidence:** Modal usage logs and a README section ("verified by partner").

### 5.4 Kiosk simulator (`apps/web/sim`, runs on the tablet)
- **Scenes:**
  1. fast-food order (4 screens, sizes, cart, pay);
  2. metro/rail ticket machine;
  3. card-terminal PIN pad (phone, calculator and **scrambled** layouts);
  4. induction/microwave panel replica;
  5. airport check-in;
  6. an adversarial set (glare overlay, low contrast, icon-only buttons, near-duplicate labels, Hindi and Spanish UIs).
- **Seeded randomization:** layout jitter, theme, language.
- **Instrumentation:** every touch → `sim_events` (`expectedTargetId`, x, y, hit element, ts). A run QR links the app session to the sim run. Success, wrong-tap and time metrics are computed **automatically**.
- **Auto-labels:** DOM element boxes are exported per screen, giving free ground truth for evals.

### 5.5 Eval harness (`evals/`, TS)
- **Datasets (self-captured only):**
  - sim screenshots plus camera photos of the tablet, auto-labeled through the quad;
  - about 60 appliance panel photos, hand-labeled;
  - at least 40 PIN-pad and payment examples.
- **Metrics:**
  - element precision and recall (label match, IoU ≥0.5);
  - target hit (center inside the ground-truth box);
  - screen-type accuracy;
  - **PIN/payment recall**;
  - p50/p95 latency;
  - cost per parse;
  - Spark vs Glimmer comparison;
  - per prompt version.
- **Live metrics:** from the sim and human trials: task success, median time-to-target, wrong-tap rate, verify accuracy.
- **CI:** a 20-image smoke eval on PRs that touch `prompts/` or `src/parse`; the full eval is triggered manually (it costs money).

### 5.6 Launch targets (release gates for v1.0.0-beta)
**Hard (safety) gates** block the public APK: PIN/payment detection recall, and zero wrong pay taps. **Soft gates** ship as beta with a known-issues list. For the PIN gate, the eval set grows to **at least 150 examples** (sim-generated layouts plus real photos), so that 98% means something.
- Single-target success **≥90%** on sim static screens.
- Median time-to-target **≤10 s**.
- PIN/payment detection recall **≥98%**.
- **0** wrong taps on payment in the test matrix.
- First-parse p50 **≤2.5 s**.
- Crash-free **≥99%** in a 30-minute soak.

---

## 6. Repo and engineering standards
```
fingerpost/                       (public GitHub, Apache-2.0, created today = hackathon-only work)
  apps/android/                   Gradle + version catalog, modules per §5.1
  apps/web/                       Vite + TS: landing, install guide, privacy, waitlist, /sim
  services/gateway/               TS Fastify, Dockerfile, prompts/
  services/private-models/        Modal Glimmer server
  packages/protocol/              zod schemas → JSON Schema, fixtures/*.json (shared with Kotlin tests)
  evals/                          datasets/, runners, reports/
  infra/                          gcloud + firebase CLI scripts, firestore.rules, indexes, budgets
  docs/                           design.md, guidance-spec.md (for the future iOS port), protocol.md,
                                  adr/000N-*.md, privacy.md, threat-model.md, testing.md, runbook.md,
                                  tester-protocol.md, consent-form.md
  .github/workflows/              android.yml, gateway.yml (deploy on main), web.yml, evals-smoke.yml,
                                  release.yml (tag → signed APK + SHA-256 → GitHub Release)
  README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY.md, LICENSE
```
- **Workspace:** pnpm for the TS packages. Trunk-based development: short PRs, at least 1 review (anyone on the team), CI green before merge.
- **Tests:**
  - Kotlin `core:guidance` gets unit tests plus **replay tests**: recorded landmark and quad JSON sequences, with no images, run deterministically.
  - Gateway gets vitest unit tests, contract tests against the fixtures, and mock-Meta integration tests.
  - Accessibility: Accessibility Scanner plus a TalkBack checklist.
- **ADRs on Day 1:**
  - 0001 Android-first;
  - 0002 brain/body split;
  - 0003 Cloud Run region;
  - 0004 Key Attestation;
  - 0005 zero retention.
- **Release:** semver. The release keystore lives in GitHub Secrets. Checksums are published. Later: an F-Droid FOSS flavor (swapping out ML Kit and Firebase).

---

## 7. The 7-day plan (IST)
**Daily rhythm:**
- 10:00 stand-up (15 min): yesterday's exit criteria, blockers, cut decisions.
- 19:30 office hours on weekdays; 20:30 from Nov 2, after US DST ends.
- 23:00 integration build plus a 10-trial proxy test.

The user floats across lanes, unblocking and integrating. Each day ends with demoable **exit criteria**. If a day's exit isn't met, the cut order in §1 applies the next morning.

### Day 1 — Tue Oct 27: foundations, and kill the biggest unknowns
- **All, first 2 hours: accounts and setup.**
  - Meta API key, and claim the $150 credits.
  - **Modal credits** (first 1,000, so claim now). Apply to Baseten as a backup.
  - GCP projects `fingerpost-dev` and `fingerpost-prod`, plus Firebase, with budget alerts at $1, $5 and $10.
  - Name checks: GitHub org, Android package `io.github.fingerpost`, X handle.
  - Create the public repo and add the Apache-2.0 license.
- **A:**
  - Compose app shell with a TalkBack single-action screen.
  - CameraX at 720p30.
  - HandLandmarker fingertip overlay with an fps counter.
  - Tone-synth prototype (pitch follows x position).
- **B:**
  - Gateway skeleton, Dockerfile, CI deploy to Cloud Run (WIF), and the protocol package.
  - Smoke-test Spark vision JSON-schema parsing on 10 panel photos.
  - SAM 3.1 box and text prompts, parsed with `@meta-sam/parser`.
  - **Latency matrix**: asia-south1 vs us-central1.
  - Image token cost.
- **C:**
  - Simulator v0: fast-food scene plus PIN pad, logging touches to Firestore, running on the tablet.
  - Photograph 40 appliance panels and label 20.
  - **Send tester outreach** to 10+ groups. India: NAB, NFB India, Saksham, XRCVC, Enable India, Mitra Jyothi, college disability cells. Global: r/Blind, RNIB forums, NFB US.
  - `docs/design.md` from this plan, plus ADRs 0001–0005.
- **Sessions:**
  - 19:30 office hours: ask whether credits cover Muse Code, about SAM latency/region, and how Modal open-weights verification works.
  - 21:30 Agents 101.
- **Exit:**
  1. A live fingertip dot at 25 fps or more on the Android phone.
  2. Spark+SAM return a valid layout and target polygon for a real panel photo.
  3. Latency and cost numbers recorded; region picked (ADR-0003).
  4. The sim scene runs on the tablet.
  5. CI green.

### Day 2 — Wed Oct 28: first closed loop on a static screen
- **A:**
  - Screen-quad acquisition: the SAM screen mask, with an OpenCV contour fallback.
  - Homography plus KLT tracking with the hand masked out; fingertip → screen coordinates; One Euro filter.
  - GuidanceEngine v1 (state machine, cue planner) with speech, tone and haptics.
  - SessionClient WS.
- **B:**
  - `fp.v1` end-to-end: keyframe → layout + target.
  - Goal → element resolution prompt; SAM target refinement.
  - **Voice Transcribe relay** (ENDPOINTING, languageBias, screen-label keywords).
  - Versioned prompts; the mock-Meta mode.
- **C:**
  - Eval harness v1 (element recall, target hit, latency, cost) on 60 labeled images; sim auto-label export.
  - Sim scenes 2 (ticket machine) and 4 (appliance replica).
  - Consent form and tester protocol; book sessions.
- **Session:** 21:30 Agents 102 "Verifiable Agents". It maps directly onto the verify step.
- **Exit:** a blindfolded teammate (a proxy, never reported as a blind-user result) reaches a voice-named button on the tablet replica in at least 5 of 10 attempts, each under 20 s. Baseline eval report v0 committed.

### Day 3 — Thu Oct 29: **tech gate** + robustness + auth/quota
- **Noon gate:** 10 trials on the tablet sim plus 10 on a real appliance. It passes at 8 of 10 or better, each under 15 s.
  - **If it fails:** cut to static single-screen tasks, reduce the agent to 2 steps, and keep only explore's summary.
- **A:**
  - Verify after a tap (screen-change detector plus server verify).
  - Framing coach.
  - Reacquire after occlusion or motion.
  - Exposure lock and glare-angle coaching.
  - TalkBack-aware speech; onboarding tutorial.
- **B:**
  - **Key Attestation** + anonymous auth + JWT.
  - Quotas, spend ledger and the kill switch; Firestore rules.
  - OTel and pino.
  - Errors with spoken messages.
- **C:**
  - Prompt iterations measured in evals.
  - PIN/payment detection set: **150 or more examples**, sim-generated plus real photos, scrambled pads included.
  - Landing page v0.
  - Tester sessions booked for Days 4–6.
- **Exit:** gate result recorded in `docs/evals/`. Single-target guide-and-verify works end to end on Cloud Run with auth and quota.

### Day 4 — Fri Oct 30: agent + safety modes + private mode
- **A:**
  - Task-mode turns (ask, answer, confirm gate with amount readout).
  - **PIN mode**: local only, cloud and mic off, earphone check, digit-under-finger, exit detection.
  - EN/HI/ES strings and TTS voices.
  - Settings screen.
- **B:**
  - **Agent loop** with tools, policy layer, step budget and go-back recovery.
  - **Glimmer on Modal** with the private-mode router.
  - HI/ES output; Glimmer vs Spark eval.
- **C:**
  - **Tester session #1**, then triage.
  - Sim scenes 3, 5 and 6.
  - Eval report v1.
- **Session:** 21:30 Fireworks session on open models (B, optional).
- **Exit:** "order a medium cola and pay" completes on the sim, with the confirm step and PIN mode. Private mode returns a usable layout from Glimmer.

### Day 5 — Sat Oct 31: explore + kiosk memory + hardening
- **A:**
  - Explore summary and touch-explore with earcons.
  - Guidance tuning from tester #1.
  - Thermal, battery and fps pass.
  - Crashlytics; in-app update check.
  - *Stretch, half a day at most:* DAT Mock Device glasses source.
- **B:**
  - **Kiosk memory** (fingerprint, LSH, trust rules, read/write).
  - Prompt caching.
  - Timeouts, retries and circuit breaker; the fallback chain.
  - Load test: 50 concurrent sessions.
- **C:**
  - Tester session #2.
  - Donation pipeline (with B): blur check, GCS lifecycle.
  - Privacy and data-safety pages; accessible install guide; README v1.
- **Exit:**
  - A known screen gets a target in under 0.8 s.
  - A 30-minute soak with no crashes.
  - Explore works on 3 scenes.

### Day 6 — Sun Nov 1: offline (if on track) + polish + release pipeline
- **A:**
  - **Offline basic mode** (OCR plus on-device ASR). Cut it if Day 5's exit was missed.
  - Audio and phrasing polish per language.
  - Low-vision visual UI.
  - Full accessibility audit.
- **B:**
  - Threat model and security review (deps, secrets, limits).
  - `release.yml` (signed APK, checksum).
  - Alerts and dashboard; runbook; Remote Config minimum version.
- **C:**
  - Final landing page (download + QR, install guide, privacy, waitlist).
  - Video script v1 and shot list; B-roll (appliance plus sim).
  - **Tester session #3**, with consented quotes.
  - Warm up the X account.
- **Exit:** v1.0.0-rc1 installs from GitHub Releases on a clean phone. Full eval run done. P0 bugs at zero.

### Day 7 — Mon Nov 2: freeze, prove, ship
- **12:00 feature freeze.**
- **Full eval:** published in `docs/evals/report-v1.md` against the §5.6 gates.
- **Bug bash:** 6 scenes × 3 languages × 2 hold modes × private on/off. Fix P0 and P1 only.
- **Ship:**
  - Tag **v1.0.0-beta**: GitHub Release, landing page live, waitlist open.
  - Record demo takes and final tester clips.
- **Exit:** the launch bar is met. Footage is in hand.

### Nov 3 (Tue) – Nov 4 (Wed): video, submission, viral
- **Nov 3:**
  - Edit the 3:00 video, with captions and narration that also works as audio description.
  - Final README: architecture diagram, eval numbers, the Meta tooling map, how private mode is verified.
  - Draft the submission text.
  - Last office hours, 20:30 IST.
  - Embargoed preview to accessibility creators and orgs.
- **Nov 4:**
  - ~19:00 IST: X post (a 60-second cut, alt text, thread with repo, APK and how it works) from @fingerpost and the user's account; teammates quote-post in the first hour.
  - **Submit by 21:00 IST** with the post link. That leaves 10.5 hours of buffer before the deadline.
  - Then push for community votes.
  - Keep min instances at 1 through judging, Nov 5–8.

---

## 8. Demo video outline (3:00)
| Time | Content |
|---|---|
| 0:00–0:12 | **Hook:** a tester at a flat-glass induction cooktop. "No bumps, no sound." → "Start, two minutes" → guided → beep → it starts. |
| 0:12–0:30 | **Stakes:** 43M blind people and 295M with moderate-to-severe vision loss; EU law allows inaccessible kiosks until 2045; the Walmart helper-theft case; today's answer is "call a human". |
| 0:30–1:25 | **Multi-step task on the tablet kiosk:** ask size → confirm price ("yes") → PIN mode with a visible "cloud off" badge and the digit under the finger heard in earphones. |
| 1:25–2:05 | **How it works:** Voice Transcribe → Spark parse/plan → SAM 3.1 masks → 30 fps on-device finger loop → verify. Private mode on Glimmer. Real latency and eval numbers. |
| 2:05–2:35 | Touch-explore, a kiosk-memory instant re-lock, and a Hindi/Spanish clip. |
| 2:35–3:00 | **Launch:** free APK today, open source, tester quotes, URL. |

## 9. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Blind users can't frame the screen | Framing coach, chest mount, wide FOV, measured from Day 2 |
| Hover vs touch can't be judged from one camera | Dwell time + screen-change detection + real touches on the sim |
| India ↔ US latency | Day-1 region measurement, an on-device loop that never waits, kiosk memory, prompt caching |
| Spark boxes are imprecise | SAM refinement, OCR alignment, evals per prompt version |
| Glimmer quality or cold start | Labeled beta, keep-warm windows, OCR geometry |
| Glare on glossy screens | Exposure lock, angle coaching, the adversarial sim scene |
| TalkBack double speech | Self-voicing queue; test on Day 3 |
| No testers by Day 4 | Wider remote outreach; proxies are labeled and never counted as blind-user results |
| Scope: 4 extras plus core | Cut order in §1; daily exit criteria |
| Sideload friction | Accessible install guide and video; Play listing once funded |
| Credits run out or API outage | Quota, kill switch, fallback chain, offline mode |
| Android phone model unknown | Minimum spec: Android 10+, a 2021+ mid-range. The tablet is a second test device. |

## 10. My calls (veto any; everything else came from you)
1. **Android stack:**
   - Kotlin/Compose/Hilt.
   - MediaPipe for hands.
   - OpenCV for tracking.
   - ML Kit for OCR and face blur.
   - minSdk 29.
   - Package `io.github.fingerpost`.
2. **Backend stack:** Fastify + zod on Node 24, with pnpm.
3. **Infra:** gcloud and firebase CLI scripts instead of Terraform (faster in 7 days).
4. **Brain/body split:** the agent and prompts live on the server.
5. **Uploads:** only the rectified screen crop after the first frame.
6. **Key Attestation instead of App Check:** forced by sideloading.
7. **Quota defaults:** 30 tasks per user per day; $12/day cap during the hackathon.
8. **Modal GPU type:** chosen by eval.
9. **Volume-key shortcuts:** in-app only, off by default.
10. **Project split:** separate dev and prod GCP projects.
11. **Submission timing:** submit by Nov 4, 21:00 IST.
12. **Local pre-upload PIN/payment gate:** on-device OCR finds a digit grid or PIN text and blocks the upload. Spark is the second layer.
13. **Framing quad:** local-first (contour plus OCR/bright-region bounds); SAM refines it on the first keyframe.
14. **Sim touches:** the sim posts to the gateway (`POST /v1/sim/events`), which writes to Firestore and relays `sim.touch` to the linked session.
15. **Kiosk memory:** independence measured by salted attested-key hashes; repeat visits served from the on-device cache.
16. **Mode choice:** `hello.mode` defaults to `auto`, and the server infers guide/task/explore from the goal. An explicit user choice wins.
17. **Kill-switch flag location:** stored in the Firestore document `config/runtime.cloudEnabled` instead of Remote Config. It's simpler for the server to write, it's read with a 30-second cache, and the budget-alert job writes the same document.
18. **Quota tiers:** hardware-attested devices get 30 tasks per UTC day; software-attested devices (emulators, very old phones) get 10.
19. **Session identity:** the Firebase anonymous uid. The JWT also carries the attested key id, and quotas are keyed by uid.
20. **Pinned dependency ages:** every pinned npm version is at least 4 days old (pnpm 11 rejects anything published within 24 h by default). `openai` is pinned to 7.32.0 for this reason, and `vite` 8.3.5 is the youngest at 6 days.
21. **Plan assets:** configs, schemas, fixtures, tests and algorithms ship verified in `docs/superpowers/plans/assets/`. Ordinary logic ships as skeletons that agents fill in (Sonnet-level plans, per the user).

## 11. Still open (not blocking Day 1)
- Teammates' names and individual strengths, so lanes can be assigned.
- Android phone model, to check performance.
- The X handle that's actually free.

---

## 12. Verification (how we know it works)
- **Every day:** the exit criteria above, run on the real Android phone and the tablet. A 10-trial proxy test logged in `docs/evals/daily.md`.
- **Automated:**
  - Kotlin unit and replay tests;
  - gateway vitest and contract tests on the shared fixtures;
  - eval smoke in CI;
  - a load test (Day 5);
  - a 30-minute soak (Day 5).
- **Release gates (§5.6):** checked on Day 7 before tagging v1.0.0-beta. A clean-phone install from GitHub Releases, using TalkBack only.
- **Human:** at least 3 blind or low-vision tester sessions (Days 4–6), each with time-to-target and success taken from sim logs, plus interview notes.
