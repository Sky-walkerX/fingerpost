# Day 3 (Thu Oct 29): Tech Gate, Robustness, Auth and Quotas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Read `AGENTS.md` first. Day 2 must be `done` in `docs/progress.md`.

**Goal:**
- Pass the noon tech gate (or apply the scope cut).
- Make guidance robust: verify after tap, framing coach, reacquire, glare.
- **No PIN-pad frame ever leaves the phone:** a local gate checks every frame before upload.
- Only our genuine app can spend the budget: Android Key Attestation, then a session JWT, then daily quotas and a spend kill switch.

**Architecture:**
- **Phone:** on-device ML Kit OCR feeds three things: the PIN gate (spec §10.1), two-source agreement (§11) and the keyframe `ocrTokens`.
- **Gateway:**
  - `/v1/auth/challenge` and `/v1/auth/attest`: Key Attestation chain → 15-minute HS256 JWT.
  - WebSockets require `Authorization: Bearer` when `AUTH_REQUIRED`.
  - `QuotaService` checks the per-uid daily tasks and the per-day spend cap. Both live in Firestore in production; memory stores are used in tests.

**Spec:**
- `docs/guidance-spec.md` §2.0, §8 (framing), §9, §10, §11;
- `docs/adr/0004-key-attestation.md`;
- `docs/design.md` §4.5–§4.7.

**Assets:** `assets/day3/`. Planning verified that the Day 3 starting state typechecks and compiles, that only Day 3 tests fail, and that the finished reference passes:
- gateway 105;
- Kotlin guidance 81;
- Kotlin protocol 41;
- web 20;
- evals 5.

**Lanes:** A = T1–T4 and T8; B = T5–T7 and T9; C = T0 (runs the gate) and T10.

## Global Constraints
Everything from Days 1–2 still applies, plus:
- **PIN gate:** at least 7 distinct single-digit OCR tokens in 3–4 rows × 3 columns, **or** PIN wording (`pin`, `enter pin`, `पिन`, `clave`, `nip`) → block the upload and enter PIN mode.
  - Row tolerance is `0.6 × median token height`; column tolerance is `0.9 × median token height`.
  - The release gate is PIN/payment recall ≥ 98% (local gate OR server), measured on 150 or more examples.
- **Session JWT:** HS256, issuer `fingerpost-gateway`, audience `fp.v1`, TTL 900 s. Claims: `sub` = Firebase anonymous uid, `kid` = attested key id (SHA-256 of the SPKI, hex), `tier` ∈ {hardware, software}.
- **Quota:** 30 tasks per UTC day (hardware), 10 (software). A task is one goal's first locate.
  - Spend cap: `DAILY_CAP_USD` (default 12).
  - Kill switch: Firestore `config/runtime.cloudEnabled`, cached 30 s.
- **Fail closed in live mode:** `AUTH_REQUIRED=false` with `MODEL_MODE=live` is rejected unless `ALLOW_UNAUTHENTICATED_LIVE=true` (pre-auth dev deploys only). Software attestation is off by default in live (`ALLOW_SOFTWARE_ATTESTATION` defaults to `MODEL_MODE !== 'live'`). The kill switch applies to unauthenticated sessions too.
- **Attestation:** package `io.github.fingerpost`.
  - Signing digests are SHA-256 of the signing certificate as lowercase hex, from `keytool -list -v`, with colons removed and lowercased.
  - Software attestation gets the `software` tier, and only where `ALLOW_SOFTWARE_ATTESTATION=true` (emulators in dev). It is forgeable, so it's off in live.
- **pnpm:** Day 3 adds `overrides: { asn1js: 3.0.10 }` and `allowBuilds` (both `false`) for `@firebase/util` and `protobufjs`, in `pnpm-workspace.yaml` (asset).

## Review Focus
1. **The first frame of a PIN pad.** It must be blocked before upload: digits in a scrambled order, Hindi or Spanish PIN wording, and keypads seen at an angle all still trigger. Covered by `PinGateTest`. Each D3-T10 miss becomes a new test case.
2. **Words that merely contain "pin"** ("Spinach", "Pinball") must **not** trigger PIN mode, which would strand the user offline. Covered by `PinGateTest.wordsContainingPinAreNotBlocked`.
3. **An attestation chain that is valid but foreign:** another app's package, another signing cert, an unknown root, a revoked intermediate or a replayed challenge. Each is rejected with a specific reason, and the log records the reason only. Covered by `attestation.test.ts` and `auth-routes.test.ts`.
4. **Hello sent before the auth check finishes.** The first messages are buffered, not lost. Covered by `auth-e2e.test.ts`.
5. **Quota counted per keyframe instead of per goal**, which would burn the quota in 30 frames. One goal counts once. Covered by `auth-e2e.test.ts` ("quota counts tasks per goal").

---

### Task D3-T0 (lane C runs it, at noon IST): the tech gate
- [ ] **Rig:**
  - the live gateway in the ADR-0003 region, with auth still off for the gate;
  - the tablet fast-food and cooktop scenes, plus one real appliance panel;
  - the Day 2 APK.
- [ ] **Trials:** 10 on the sim and 10 on the real appliance, by a blindfolded proxy, each with a different voice-named target.
  - **Time-to-target:** from the end of the "Found …" speech to ON (the haptic).
  - **Success:** ON is reached on the right element, and a press is detected.
  - Log every trial in `docs/evals/gate-day3.md`: trial, surface, target, seconds, success, notes.
- [ ] **Decision:**
  - **Pass:** at least 8 of 10 under 15 s on **each** surface.
  - **Fail:** apply the scope cut from design §7 Day 3 (static single screens first, a 2-step agent, explore summary only). Write the decision into `docs/progress.md`, and change the Day 4–7 plans that evening.
- [ ] **Commit:** `git commit -m "docs(evals): day 3 tech gate result"`

### Task D3-T1 (device): on-device OCR, face covering, OCR tokens in keyframes
**Files:**
- `apply.sh 3 apps/android/build.gradle.kts apps/android/gradle/libs.versions.toml apps/android/app/build.gradle.kts --force`. This adds ML Kit, Firebase Auth and google-services.
- Create `app/src/main/kotlin/io/github/fingerpost/vision/{Ocr,FaceCover}.kt`. Modify `session/Keyframer.kt`.
- **Human:** download `app/google-services.json` from the Firebase console (Android app, package `io.github.fingerpost`). It's gitignored; CI needs it too, as the GitHub Actions secret `GOOGLE_SERVICES_JSON` decoded into the file before building. Add that step to `ci.yml`.

**Requirements:**
- **`Ocr` runs two recognizers**, Latin and Devanagari:
  ```kotlin
  val latin = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  val deva  = TextRecognition.getClient(DevanagariTextRecognizerOptions.Builder().build())
  // InputImage.fromBitmap(bitmap, 0) → Tasks.await(latin.process(img)) …
  ```
  - Collect `Text.Element`s (words) from both recognizers.
  - Drop duplicates whose boxes overlap with IoU > 0.5 and whose text is equal.
  - Map each one to `io.github.fingerpost.guidance.OcrToken(text, u, v, w, h)`, normalized to the bitmap it ran on.
  - Run at most 5 Hz, on a 1024-wide frame, off the analysis thread.
- **`FaceCover.cover(bitmap): Bitmap`:** ML Kit face detection in `PERFORMANCE_MODE_FAST`. Each face box, expanded by 20%, is painted solid black (`Canvas.drawRect`). It's used on every `full` keyframe before encoding.
- **Keyframer:** the header's `ocrTokens` = tokens normalized to the **uploaded** image, at most 400, text at most 200 chars.
  - For a `screen` (rectified) keyframe, map tokens through the same perspective transform.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Check on the device.**
  - Logcat (debug build only) shows token counts, never the text.
  - On the tablet PIN pad scene, 10 digit tokens are found.
  - A face held in view is black in the saved debug JPEG. Save it to app cache only; never upload it while testing.
- [ ] **Step 3: Commit:** `git commit -m "feat(android): on-device OCR (Latin + Devanagari), face covering, OCR tokens in keyframes"`

### Task D3-T2: PIN gate and two-source agreement (pure Kotlin, then device integration)
**Files:**
- `apply.sh 3` with `apps/android/core/guidance/src/main/kotlin/io/github/fingerpost/guidance/{Ocr,PinGate,ScreenChange,Framing}.kt` and `apps/android/core/guidance/src/test/kotlin/io/github/fingerpost/guidance/Day3Test.kt`.
  - Copy all four files now: `Day3Test.kt` covers all of them. T3 implements ScreenChange and Framing.
- **Finished:**
  - `PinGate.kt` (the grid clustering);
  - `normalizeLabel` and `tokenSetRatio` in `Ocr.kt`. These must stay byte-for-byte equivalent to the gateway's `normalizeLabel` and `tokenSetRatio`.
- **Skeleton:** `Ocr.kt` `twoSourceAgree`.

**Interfaces:**
- `twoSourceAgree(label, box: Bbox, tokens)`:
  - Tokens whose centre is inside `box` are joined with spaces.
  - Agreement means `tokenSetRatio(label, joined) ≥ 0.8`.
  - No tokens inside → `false`.
- **Device integration:** `UploadGuard.mayUpload(tokens): Boolean`, a new file in `app/.../safety/UploadGuard.kt`:
  - Calls `PinGate.check(tokens)`.
  - **On `DIGIT_GRID` or `PIN_TEXT`:**
    - block the upload;
    - stop the mic (`MicStreamer.stop()`);
    - send `ClientEvent(kind = PIN_MODE_ENTERED)` with no detail;
    - say (SAFETY priority) "PIN pad detected. I'll stay offline while you enter it.";
    - the UI shows "Cloud off".
  - **Every keyframe send goes through it.** Add a unit-free check: `Keyframer` takes an `UploadGuard` and returns `null` when blocked.
  - **Exit:** after 2 s with fewer than 5 digit tokens, send `PIN_MODE_EXITED`, say "Back online.", and request a fresh keyframe.
  - The full digit-under-finger PIN mode is Day 4.
- **Two-source agreement on device:** when a `target` arrives for a text label, compute `twoSourceAgree(label, targetBbox, latestTokens)`.
  - **False:** replace the arrival speech with "I think this is <label>, but I'm not sure." Use the same SAFETY rule for `pay|confirm|submit` roles (Day 4 adds the confirm gate).

- [ ] **Step 1: Confirm red.** Run `./gradlew :core:guidance:test`. PinGateTest passes; TwoSourceTest, ScreenChangeTest and FramingTest fail.
- [x] **Step 2: Implement `twoSourceAgree`.** TwoSourceTest goes green.
- [x] **Step 3: Implement `UploadGuard`** and wire it in.
- [ ] **Step 4: Check on the device.**
  - Open the tablet PIN pad scene (phone, calculator and scrambled).
  - Gateway logs show **no** keyframe after the pad appears.
  - The app says the PIN line.
  - Switching back to the fast-food scene brings "Back online."
  - Record in progress.md.
- [ ] **Step 5: Commit:** `git commit -m "feat: local PIN gate blocks uploads; two-source agreement on targets"`

### Task D3-T3: press evidence (screen change) and framing coach
**Files:** skeletons:
- `ScreenChange.kt`: `setReference`, `update`;
- `Framing.kt`: `QuadStability.update`, `FramingCoach.evaluate`, `cueToSpeak`.

Device integration happens in `GuidanceEngine` and `QuadEstimator`.

**Interfaces (guidance-spec §8 and §9):**
- **`ScreenChangeDetector(tau = 0.08, framesNeeded = 3)`:**
  - Frames are 160×90 grayscale in [0,1].
  - Mean absolute difference over pixels **not** in the hand mask.
  - Returns true once, when the third consecutive frame with MAD > τ arrives.
  - `setReference` resets the run and the fired flag.
- **`QuadStability(frames = 10, maxMove = 0.01)`:** stable once every corner has moved less than 1% of the frame diagonal for 10 consecutive updates. A `null` quad resets it.
- **`FramingCoach.evaluate`**, checks in order:
  1. no quad → `NO_SCREEN`;
  2. area > 85% → `MOVE_BACK` (checked **before** cut-off);
  3. any corner within 4% of an edge → `CUT_LEFT` / `RIGHT` / `TOP` / `BOTTOM`, in that order;
  4. area < 15% → `MOVE_CLOSER`;
  5. centre offset > 15% → `MOVE_LEFT` / `RIGHT` / `UP` / `DOWN`, with the dominant axis first;
  6. otherwise `GOOD`.
- **`cueToSpeak`:** returns `null` for `GOOD` and within 1.5 s of the last spoken cue.
- **Device wiring:**
  - On ON_TARGET entry: `setReference(rectifiedSmallGray)`.
  - On each frame: `update(frame, handMask)`. True → `PressDetected(SCREEN_CHANGE)`.
  - Dwell evidence: ON for 0.8 s or more and target occlusion over 60%, then release → `PressDetected(DWELL)`.
  - In FRAMING, map `FramingCoach` cues to speech:
    - `NO_SCREEN`: "I can't see a screen. Point the phone at it."
    - `CUT_LEFT`: "The screen's left edge is cut off. Move the phone left." (and likewise for the other edges)
    - `MOVE_CLOSER`: "Move closer."
    - `MOVE_BACK`: "Move back a little."
    - `MOVE_LEFT` etc.: "Move the phone left."
    - `GOOD`: a soft tick earcon, not speech.
  - `QuadStability` replaces the Day 2 stability check.

- [x] **Step 1: Implement the Kotlin.** Then `./gradlew :core:guidance:test`: all 81 pass.
- [ ] **Step 2: Wire it up on the device, and check:**
  - pressing a real cooktop key gives "Done" without a sim touch;
  - pointing half off the tablet gives the cut-off cue.
- [ ] **Step 3: Commit:** `git commit -m "feat: screen-change press evidence and framing coach"`

### Task D3-T4 (device): reacquire, glare, TalkBack-aware speech, onboarding
**Requirements:**
- **Reacquire:**
  - `ScreenTracker` `LOST` → `Haptic(LOST)`, "Hold the phone steady", then back to FRAMING, keeping the goal.
  - When the quad is back, request a `locate` keyframe. The server re-sends the target; Day 5 kiosk memory makes this instant.
- **Exposure:**
  - When the quad is stable, call `cameraControl.startFocusAndMetering(FocusMeteringAction.Builder(pointAtQuadCentre, FLAG_AF or FLAG_AE).setAutoCancelDuration(5, SECONDS).build())`.
  - When glare is detected (more than 8% of screen-quad pixels with V ≥ 0.98), say "There's glare. Tilt the phone a little." at most every 5 s.
- **TalkBack:**
  - If `AccessibilityManager.isTouchExplorationEnabled`, the app still speaks with its own TTS and **never** calls `announceForAccessibility` for guidance cues; it uses it only for state changes ("Guiding", "Done").
  - TTS uses `USAGE_ASSISTANCE_ACCESSIBILITY`, so TalkBack ducks it correctly.
- **Onboarding**, first launch only, stored in DataStore:
  1. "Fingerpost helps you press buttons on touchscreens."
  2. "Hold the phone in one hand about an arm's length from the screen, or wear it on a chest mount."
  3. "Point with your other index finger. Higher tones mean closer. A strong buzz means tap."
  4. "Say what you want to press after the question."
  - Each line can be repeated with a double tap, and skipped with a two-finger swipe (a TalkBack custom action "Skip tutorial").
- [ ] **Step 1: Implement**, then run a 10-minute session with TalkBack on. Record what was confusing in progress.md.
- [ ] **Step 2: Commit:** `git commit -m "feat(android): reacquire, exposure/glare coaching, TalkBack-aware speech, onboarding"`

### Task D3-T5: Key Attestation verifier (gateway)
**Files:**
- `apply.sh 3` with:
  - `pnpm-workspace.yaml`;
  - `services/gateway/package.json` (adds pkijs 3.4.1, asn1js 3.0.10, jose 6.2.12, firebase-admin 14.5.0);
  - `services/gateway/src/auth`;
  - `services/gateway/certs/README.md`;
  - `services/gateway/test/attestation.test.ts`, `services/gateway/test/helpers`.
- Then `pnpm install`. With the asset's `allowBuilds`, it prints no "ignored builds" error.
- **Finished:**
  - `auth/key-description.ts` (the ASN.1 `KeyDescription` parser);
  - `auth/google-roots.ts`;
  - `test/helpers/fake-attestation.ts`, which builds real root → intermediate → leaf chains with a KeyDescription extension.
- **Skeleton:** `auth/attestation.ts` (`verifyAttestation`). The helpers `spki` and `normSerial` are given.

**Interface:** `verifyAttestation(chainDer, expectedChallenge, policy)`. Reasons (the exact strings are asserted), checked in this order:
1. chain length not in 2..10 → `chain length`;
2. any certificate unparseable → `unparseable certificate`;
3. for each cert i:
   - not valid now → `certificate i not valid now`;
   - `isRevoked(normSerial(serial))` → `certificate i revoked`;
   - `!checkIssued(issuer) || !verify(issuer.publicKey)` → `certificate i not signed by its issuer`. The issuer is cert i+1; the last cert is self-issued.
4. the root's SPKI isn't among `trustedRoots` → `untrusted root`;
5. the leaf has no extension `1.3.6.1.4.1.11129.2.1.17` → `no attestation extension`; a parse error → `bad attestation extension: …`;
6. challenge mismatch (`timingSafeEqual`, length checked first) → `challenge mismatch`;
7. software level without `allowSoftware` → `software attestation not allowed`;
8. package not in `packageNames` → `wrong package`;
9. no digest in `signatureDigests` → `wrong signing certificate`.

On success it returns `{ ok: true, level, keyId: sha256hex(leaf SPKI DER) }`.
- Use `node:crypto` `X509Certificate` for the chain checks, and `pkijs.Certificate.fromBER(leafDer).extensions` to find the extension (`extnValue.valueBlock.valueHexView`).

- [ ] **Step 1: Confirm red** (attestation tests fail), **implement**, then **confirm green** with `pnpm --filter @fingerpost/gateway test -- attestation`. Expected: 15 pass.
- [ ] **Step 2: Add the real Google roots (human + agent).**
  - Copy the root certificate PEM blocks from `https://developer.android.com/privacy-and-security/security-key-attestation#root_certificate` into `services/gateway/certs/google-roots.pem`.
  - Record each root's SHA-256 fingerprint (`openssl x509 -in <one> -noout -fingerprint -sha256`) in ADR-0004 under "Roots".
  - **A human reviewer compares the fingerprints with the page** before merging.
- [ ] **Step 3: Commit:** `git commit -m "feat(gateway): Android Key Attestation verifier"`

### Task D3-T6: challenges, session tokens, auth routes
**Files:**
- `apply.sh 3` with `services/gateway/test/{quota,auth-routes}.test.ts`. The `src/auth` files came in T5.
- **Skeletons:** `auth/challenges.ts`, `auth/tokens.ts`, `auth/routes.ts`.

**Interfaces:**
- **`ChallengeStore(now = Date.now, ttlMs = 300 000)`:**
  - `issue()` → `{ challengeId: ulid(), nonce: 32 random bytes }`, and sweeps expired entries.
  - `take(id)` deletes the entry and returns the nonce only if it hasn't expired; otherwise `null`.
- **Tokens:**
  - `issueSessionToken(secret, {uid, keyId, tier}, nowMs)`: jose `SignJWT({kid, tier})` with header `{alg:'HS256'}`, subject uid, issuer, audience, iat, and exp = iat + 900.
  - `verifySessionToken(secret, token, nowMs)`: `jwtVerify` with issuer, audience, `algorithms:['HS256']` and `currentDate: new Date(nowMs)`. It returns `null` on any error or a wrong claim shape.
- **`registerAuthRoutes(app, deps)`:**
  - `POST /v1/auth/challenge` → `{ challengeId, nonce: base64url }`.
  - `POST /v1/auth/attest`, body `{challengeId, chain: base64[], firebaseIdToken}`:
    - invalid body → 400;
    - unknown or used challenge → 401;
    - Firebase token rejected → 401;
    - attestation rejected → 403, logging `{reason}` only;
    - success → `{ token, expiresIn: 900, tier }`, where `tier` is `software` when the level is software and `hardware` otherwise.

- [ ] **Step 1: Confirm red, implement, confirm green.** Run `pnpm --filter @fingerpost/gateway test -- quota auth-routes`. `quota.test.ts` also exercises `QuotaService`, which is T7; its quota cases stay red until T7.
- [ ] **Step 2: Commit:** `git commit -m "feat(gateway): attestation challenges, session JWT, auth routes"`

### Task D3-T7: quotas, kill switch, auth on the socket (Day 3 app)
**Files:**
- `apply.sh 3` with `services/gateway/src/{config,app,server}.ts`, `services/gateway/src/quota` and `services/gateway/test/auth-e2e.test.ts`.
- **Finished:**
  - `config.ts`: `AUTH_REQUIRED` (default: true in live), `SESSION_SECRET` (32+ chars), `SIGNING_DIGESTS`, `ALLOW_SOFTWARE_ATTESTATION`, `DAILY_CAP_USD`, `FIREBASE_PROJECT_ID`;
  - `app.ts` (auth routes, the socket auth check with **early-message buffering**, the quota wiring, the fail-closed sim route);
  - `auth/rate-limit.ts` (per-IP limits: 60 challenges and 20 attests per hour → 429);
  - `server.ts` (firebase-admin wiring for live);
  - `quota/firestore-stores.ts`.
- **Skeleton:** `quota/service.ts` (`QuotaService` methods, `utcDay`). `DEFAULT_QUOTA` is given.

**Interface:** `QuotaService(store, flags, cfg = DEFAULT_QUOTA, now)`:
- **`cloudEnabled()`:** cached for `flagCacheMs`.
- **`startTask(uid, tier)`:**
  - paused → `cloud_paused`;
  - otherwise `n = incrementTasks(uid, utcDay(now))`;
  - `n > limit` → `quota_exhausted`; else `{ok, tasksLeft: limit − n}`.
- **`recordUsage(u)`:**
  - `addSpend(day, costMicros(u))`;
  - if the total is ≥ the cap, `flags.setCloudEnabled(false, 'daily cap reached (<total> µ$)')` and set the cache to false.
  - Returns the total.
- **`utcDay(ms)`:** `new Date(ms).toISOString().slice(0, 10)`.

- [ ] **Step 1: Confirm red, implement, confirm green.** Run `pnpm --filter @fingerpost/gateway test && pnpm --filter @fingerpost/gateway typecheck`. Expected: 105 pass.
- [ ] **Step 2: Firestore rules.** Create `infra/firestore.rules`:
  ```
  rules_version = '2';
  service cloud.firestore { match /databases/{db}/documents { match /{document=**} { allow read, write: if false; } } }
  ```
  Clients never touch Firestore; the gateway uses the Admin SDK, which bypasses rules.
  - Create `infra/firebase.json` with `{ "firestore": { "rules": "firestore.rules" } }`.
  - **Human:** deploy with `npx firebase-tools@14 deploy --only firestore:rules --project fingerpost-dev` (CLI version per `npm view firebase-tools version`, pinned).
  - **Human:** create the Firestore database (Native mode) in the ADR-0003 region first.
- [ ] **Step 3: Kill-switch document.** Write `config/runtime` as `{cloudEnabled: true}` once (console). The GCP budget alert → Pub/Sub → a job that sets it to false is Day 6 (runbook).
- [ ] **Step 4: Commit:** `git commit -m "feat(gateway): quotas, spend kill switch, authenticated sessions"`

### Task D3-T8 (device): attestation client, Firebase anonymous auth, authenticated socket
**Files:** create `app/src/main/kotlin/io/github/fingerpost/session/Auth.kt`. Modify `SessionClient.kt`.

**Requirements:**
```kotlin
// 1. Firebase anonymous user → ID token
val user = Firebase.auth.currentUser ?: Firebase.auth.signInAnonymously().await().user!!
val idToken = user.getIdToken(false).await().token!!
// 2. challenge → hardware key bound to it → chain
val (challengeId, nonceB64) = POST /v1/auth/challenge          // OkHttp + kotlinx.serialization
val nonce = Base64.decode(nonceB64, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
val alias = "fp-attest"
val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
    .setDigests(KeyProperties.DIGEST_SHA256).setAttestationChallenge(nonce)
val kpg = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
try { kpg.initialize(spec.setIsStrongBoxBacked(true).build()); kpg.generateKeyPair() }
catch (e: StrongBoxUnavailableException) { kpg.initialize(spec.setIsStrongBoxBacked(false).build()); kpg.generateKeyPair() }
val chain = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.getCertificateChain(alias)
    .map { Base64.encodeToString(it.encoded, Base64.NO_WRAP) }
// 3. attest → token (15 min)
POST /v1/auth/attest { challengeId, chain, firebaseIdToken = idToken } → { token, expiresIn, tier }
```
- **Token reuse:** keep the token in memory only. Refresh it at 12 minutes, or on `error{code:'auth_expired'}`, or when the socket closes with 4401.
- **WebSocket:** the request gets `.header("Authorization", "Bearer $token")`.
- **Base URL:** HTTP calls use the gateway base, `BuildConfig.GATEWAY_URL` with `ws`→`http` and `wss`→`https`.
- **Signing digest for the server:** run `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android` and take the SHA256 line → remove colons → lowercase. Put it in the dev `SIGNING_DIGESTS`. The release keystore digest is added on Day 6.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Check locally.** Run the gateway with `MODEL_MODE=live AUTH_REQUIRED=true SESSION_SECRET=… SIGNING_DIGESTS=<debug digest>`, plus real Firebase credentials (`gcloud auth application-default login`).
  - The app connects, and logs `tier=hardware`. An emulator only gets in with `ALLOW_SOFTWARE_ATTESTATION=true` added locally (tier `software`); never set that on Cloud Run.
- [ ] **Step 3: Commit:** `git commit -m "feat(android): Key Attestation + Firebase anonymous auth for authenticated sessions"`

### Task D3-T9: deploy with auth on
- [ ] **Secrets:**
  - `openssl rand -base64 48 | tr -d '\n' | gcloud secrets create session-secret --data-file=- --project fingerpost-dev`
  - The `SIGNING_DIGESTS` value isn't secret; pass it as an env var.
- [ ] **Deploy script.** Update `infra/deploy-gateway.sh`:
  - add `SESSION_SECRET=session-secret:latest` to `--set-secrets`;
  - change the env vars to `AUTH_REQUIRED=true,SIGNING_DIGESTS=<debug digest>,FIREBASE_PROJECT_ID=fingerpost-dev,DAILY_CAP_USD=12`;
  - give the Cloud Run service account **Cloud Datastore User** and **Firebase Authentication Viewer**.
- [ ] **Deploy and smoke-test.**
  - Deploy, then `curl <url>/healthz`.
  - A socket **without** a token closes with 4401.
  - The app does one full guided task, and Firestore `users/<uid>` shows `tasksToday: 1`.
- [ ] **Commit:** `git commit -m "chore(infra): auth-on deploy of the gateway"`

### Task D3-T10 (lane C): PIN/payment dataset (150+), landing page v0, tester bookings
- [ ] **Sim renderer.** Create `evals/scripts/render-sim.ts` using Playwright.
  - Add the devDependency `playwright` (pin the newest release that's at least 7 days old), and run `pnpm exec playwright install chromium`.
  - For seeds 1–40 × layouts {phone, calculator, scrambled}, plus fast-food pay screens for seeds 1–30:
    - open `apps/web` `dist/sim/?scene=…`;
    - screenshot at 1280×800 to `evals/datasets/pinpay/<name>.png`, converted to JPEG;
    - write `labels.json` items with `screenType: "pin_pad"` or `"payment_entry"` and element boxes from `labelsFor`.
  - Use `page.evaluate` to get them: expose `window.__fp = { labels: labelsFor(currentScreen(state)) }` in `main.ts` when `?export=1` is set. That's a two-line change to the asset main; record it.
  - This gives 150 sim images. Add 20 or more **real** photos (shop card terminals with the owner's permission and no customers; the team's own phones' PIN screens), labeled with the labeling page.
- [ ] **Measure.** Run `pnpm --filter @fingerpost/evals eval --set pinpay --mode live --out ../docs/evals/report-pinpay-day3.md`, and report the server-side recall.
  - Local-gate recall needs the on-device OCR. Run the Android instrumentation-free harness on Day 4: feed the dataset images through `Ocr` + `PinGate` in a debug screen, and log the counts.
- [ ] **Landing page v0.** In `apps/web/index.html`:
  - what Fingerpost does (3 sentences), who it's for, "Beta coming Nov 2", and a waitlist form;
  - the form handler POSTs to `/v1/waitlist` from Day 6, but for now stores nothing and shows "Thanks, we'll email you when the beta is ready". No storage before the privacy page exists.
  - It must be accessible: landmarks, labels, AA contrast, keyboard-only use.
- [ ] **Testers.** Confirm the Days 4–6 tester sessions in `docs/testers.md`.
- [ ] **Commit:** `git commit -m "evals+web: PIN/payment dataset, landing page v0"`

---

## Day 3 exit check (23:00 IST)
- Gate result recorded (D3-T0).
- With the tablet PIN pad, the gateway logs **no** upload (D3-T2).
- Single-target guide and verify work end to end on Cloud Run **with auth and quota** (D3-T9).
- Gateway CI shows 105 tests green.
- The Day 4–7 plans get written tonight from these results (see `docs/progress.md`).
