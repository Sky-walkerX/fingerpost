# Day 1 (Tue Oct 27): Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read `AGENTS.md` first.

**Goal:** Stand up the monorepo and remove Day 1's unknowns. Tonight's exit checks:
- a live fingertip dot on the Android phone;
- a real Spark and SAM 3.1 parse of a real panel photo, with latency and cost numbers;
- kiosk simulator v0 running on the tablet;
- CI green.

**Architecture:**
- A pnpm monorepo of TypeScript packages (`packages/protocol`, `services/gateway`, `apps/web`) plus a Gradle project (`apps/android`).
- `packages/protocol` is the contract: zod schemas and golden JSON fixtures, which the Kotlin tests also parse from Day 2.
- The gateway calls the Meta Model API through the OpenAI SDK and parses SAM output with `@meta-sam/parser`.

**Tech stack:** exactly the versions in `AGENTS.md` §6. Every `package.json`, `libs.versions.toml` and Gradle file is a plan asset with the versions pinned.

**Spec:** `docs/design.md` (§4, §5, §7 Day 1), `docs/guidance-spec.md`, `docs/protocol.md`, `docs/adr/`.

**How assets work:** `docs/superpowers/plans/assets/day1/` mirrors the repo.
- `docs/superpowers/plans/assets/apply.sh 1 <path>` copies an asset to the same path in the repo.
- **Skeleton** files contain real signatures and doc comments, with bodies that `throw new Error('TODO(D1-Tn) …')` (TS) or `TODO("D1-Tn …")` (Kotlin). You write those bodies; the tests are already written.
- All other assets are finished and verified. Don't edit them unless a step says so.
- Planning verified the whole TypeScript side and the pure-Kotlin modules with these exact files. With the skeletons in place everything typechecks and compiles, and only this day's tests fail.

**Lanes:** they run in parallel. T2–T5 are lane B, T6 and T8 lane C, T7a–T7d lane A. T0 and T1 are shared and come first.

## Global Constraints
- **License:** Apache-2.0 (root `LICENSE`, already committed).
- **App id / package:** `io.github.fingerpost`, minSdk 29, target SDK 36, compile SDK 37 (D1-T7b first-build correction; pinned Compose/Core libraries require API 37).
- **Protocol:**
  - `fp.v1`; binary frame `[u32 BE headerLen][UTF-8 JSON header][payload]`.
  - Limits: text ≤ 16 384 B, header ≤ 16 384 B, keyframe payload ≤ 409 600 B.
- **Meta API:**
  - base `https://api.meta.ai/v1`; models `muse-spark-1.3`, `sam-3.1`.
  - **Never** use a `-contributor` id.
  - Spark grounding uses a 0–1000 grid (it may overshoot, so clamp).
- **Geometry:** screen coordinates are `u, v ∈ [0,1]`; polygons have 3–32 points.
- **Secrets:**
  - `META_API_KEY` only in `.env` (gitignored) or Secret Manager `meta-api-key`.
  - The APK never contains a key.
- **Logs:** ids, sizes, latencies and outcomes only. No image bytes, audio, transcripts or OCR text.
- **Test data:** team-captured photos only. Photos with faces or personal data go in `evals/datasets/private/` (gitignored).

## Review Focus
These are the inputs most likely to break things for a real user. Each is pinned by tests:

1. **Spark boxes outside 0–1000, or with min > max.** They are clamped and reordered, never thrown. Tested in `test/geometry.test.ts` (normalizeSparkBox) and `test/spark-parse.test.ts`.
2. **SAM returns zero objects, or several for one box.** The result is `null`, or the highest-confidence mask (ties go to the larger area), with no crash. Tested in `test/sam.test.ts`.
3. **Malformed binary frames:**
   - `headerLen` larger than the buffer;
   - a non-UTF-8 header;
   - a keyframe over 400 KB;
   - a keyframe sent as text.

   Each gets `bad_message`, and the socket stays usable. Tested in `packages/protocol/test/frame.test.ts` and `services/gateway/test/session.test.ts`.
4. **A peer on a newer protocol version.** The client ignores unknown server types; the server answers unknown client types with `bad_message` and an old `hello` protocol with `version_unsupported`. Tested in `fixtures.test.ts` and `session.test.ts`.
5. **Sim taps on gaps, multi-touch and rapid double taps.** Each one is logged, with `elementId: null` for misses. Tested in `apps/web/test/sim.test.ts`.

---

### Task D1-T0 (human; all three; first two hours): accounts and tooling
Needs people, credentials or money. Agents mark dependent tasks `blocked` until it's done.

- [x] **Android Studio:** **Linux laptop equivalent verified 2026-10-28: existing Studio, JDK 21, Platform 36, Build Tools 36.0.0 and Platform Tools; project launcher/IDE paths configured (see docs/local-development.md).** macOS instructions: run `brew install --cask android-studio`. Open it once, then install SDK Platform 36, Build-Tools, and Platform-Tools.
  - **Check:** `~/Library/Android/sdk/platform-tools/adb version` prints a version.
  - Add to `~/.zshrc`, then run `source ~/.zshrc`:
    - `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`
    - `export ANDROID_HOME="$HOME/Library/Android/sdk"`
  - Gradle comes from the committed wrapper, so there's no separate Gradle install.
- [ ] **Meta Model API:**
  - **2026-10-30 evidence:** private key accepted (models HTTP 200; live Spark/SAM/Voice Transcribe integration passes). Credit claim/balance remains unverified, so this setup item is not complete. See `docs/evals/through-day2-t7-2026-10-30.md`.
  - Create a key at dev.meta.ai and claim the $150 credits.
  - In the repo root: `printf 'META_API_KEY=%s\n' '<key>' > .env`
  - **Check:** `set -a; source .env; set +a; curl -s https://api.meta.ai/v1/models -H "Authorization: Bearer $META_API_KEY" | head -c 400` lists `muse-spark-1.3`.
- [ ] **Partner credits:** claim Modal credits (first 1,000 people only); apply to Baseten as a backup.
- [ ] **GCP:**
  - Create `fingerpost-dev` and `fingerpost-prod`: `gcloud projects create fingerpost-dev`, then the same for `fingerpost-prod`.
  - Link billing in the console.
  - On both projects: `gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com firestore.googleapis.com --project <id>`
  - Add Firebase to both projects (console → Add project → pick the existing GCP project).
  - Budget alerts at $1, $5 and $10 (console → Billing → Budgets).
  - **Check:** `gcloud projects list | grep fingerpost` shows both.
- [ ] **Artifact Registry**, on dev: `gcloud artifacts repositories create fp --repository-format=docker --location=asia-south1 --project fingerpost-dev`. Repeat with `--location=us-central1`.
- [ ] **Name checks:**
  - an X handle (`@fingerpost` or `@fingerpostapp`);
  - package id `io.github.fingerpost`. If GitHub won't give us that namespace, keep the id anyway: Android doesn't require domain ownership.
- [ ] **Test photos:** photograph at least 10 appliance panels (microwave, induction cooktop, washing machine, AC remote screen). Use varied angles and light, with no faces or reflections of people.
  - Save as JPEG in `evals/datasets/day1/`.
  - Put one 1024×576 crop, at most 409,600 bytes, in `evals/datasets/private/day1/latency-sample.jpg` (gitignored). Leave the tracked four-byte synthetic placeholder unchanged; real captures must never replace committed fixtures.
- [ ] **Testers:** send outreach (texts from D1-T8) to 10 or more groups. Log each in `docs/testers.md`.

### Task D1-T1: monorepo root
**Files:** copy assets `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.nvmrc`, `.dockerignore` and `.github/workflows/ci.yml`. Create `SECURITY.md`, `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`.

**Interfaces:**
- **Produces:** the workspace (`packages/*`, `services/*`, `apps/web`, `evals`) and the `source` export condition.
  - Every TS package's `exports` maps `"source"` to `./src/index.ts`, so tests and `node --conditions=source` run straight from source.
  - Builds use `dist/`.

- [x] **Step 1: Copy the root assets.**
  `docs/superpowers/plans/assets/apply.sh 1 package.json pnpm-workspace.yaml tsconfig.base.json .nvmrc .dockerignore .github`
- [x] **Step 2: Write the three docs.**
  - `SECURITY.md`: report vulnerabilities privately to the maintainers' email (placeholder `security@fingerpost.invalid` until a real address exists). Don't open public issues for them.
  - `CONTRIBUTING.md`: points to `AGENTS.md` §3–§8.
  - `CODE_OF_CONDUCT.md`: the Contributor Covenant 2.1 text, with the same contact.
- [x] **Step 3: Verify.** Run `pnpm install && pnpm -r test`. It should exit 0 ("No projects matched" is fine at this point).
- [x] **Step 4: Commit and push.**
  `git add -A && git commit -m "chore: workspace root, CI workflow, community docs" && git push`

### Task D1-T2: `packages/protocol`, the fp.v1 contract
**Files (all from assets):** `packages/protocol/**`.
- Skeletons:
  - `src/frame.ts` (`encodeFrame`, `decodeFrame`);
  - `src/parse.ts` (`parseClientMessage`, `parseServerMessage`).
- Finished: `src/common.ts`, `src/client.ts`, `src/server.ts`, `src/index.ts`, `scripts/export-json-schema.ts`, `fixtures/valid/*` (24), `fixtures/invalid/*` (9), `test/fixtures.test.ts`, `test/frame.test.ts`.

**Interfaces (Produces):**
- `encodeFrame(header: object, payload: Uint8Array): Uint8Array`
- `decodeFrame(buf: Uint8Array): { ok: true; header: unknown; payload: Uint8Array } | { ok: false; error: 'short' | 'header_too_large' | 'header_not_utf8' | 'header_not_json' }`
- `parseClientMessage(json: unknown): { ok: true; msg: ClientMessage } | { ok: false; error: string }`
  - Unknown types and invalid input → `ok:false`. Extra fields are stripped.
- `parseServerMessage(json: unknown): { kind: 'ok'; msg } | { kind: 'unknown'; type } | { kind: 'invalid'; error }`
  - Returns `unknown` when `type` is a string that isn't in `SERVER_TYPES`.
- Constants `PROTOCOL`, `LIMITS`, `CLIENT_TYPES` and `SERVER_TYPES`, plus all schema and type exports from `common/client/server.ts`.

- [x] **Step 1: Copy.** `docs/superpowers/plans/assets/apply.sh 1 packages/protocol && pnpm install`
- [x] **Step 2: Confirm red.** Run `pnpm --filter @fingerpost/protocol test`. Expected: 45 failed, 1 passed (every test that touches the skeletons throws TODO).
- [x] **Step 3: Implement `src/frame.ts`.**
  - Big-endian u32 length via `DataView.setUint32(0, len, false)`.
  - Check the order exactly as the tests require:
    1. under 4 bytes → `short`;
    2. len > `LIMITS.headerBytes` → `header_too_large`;
    3. buffer shorter than 4 + len → `short`;
    4. `new TextDecoder('utf-8', { fatal: true })` throws → `header_not_utf8`;
    5. `JSON.parse` throws → `header_not_json`.
  - Use `buf.byteOffset` when making the DataView (a test passes a subarray).
- [x] **Step 4: Implement `src/parse.ts`.**
  - Both functions use `safeParse` on the union.
  - `parseServerMessage` first reads `type`. If `type` is a string not in `SERVER_TYPES`, return `{kind:'unknown', type}`.
  - Non-objects → `invalid`.
- [x] **Step 5: Confirm green.** Run `pnpm --filter @fingerpost/protocol test && pnpm --filter @fingerpost/protocol typecheck`. Expected: 46 passed, no type errors.
- [x] **Step 6: Export the JSON Schema.** Run `pnpm --filter @fingerpost/protocol schema`. Expected: `wrote schema/client.json and schema/server.json`. The `schema/` directory is a build output; add it to `.gitignore` if it isn't already.
- [x] **Step 7: Commit.**
  `git add packages/protocol .gitignore && git commit -m "feat(protocol): fp.v1 schemas, binary framing, golden fixtures"`

### Task D1-T3: gateway skeleton (config, session hub, app, container)
**Files:** copy the whole Day 1 gateway: `docs/superpowers/plans/assets/apply.sh 1 services/gateway`. This brings the T4 files too, so imports resolve.
- **Skeletons for this task:**
  - `src/config.ts` (`loadConfig`);
  - `src/session/hub.ts` (all `SessionHub` methods).
- **Finished:**
  - `src/app.ts`, `src/server.ts`, `src/debug/latency.ts`;
  - `src/models/{meta-client,port}.ts`, `src/models/mock/mock-models.ts`;
  - `prompts/parse-screen.v1.md`, `Dockerfile`;
  - `test/app.test.ts`, `test/session.test.ts`.

**Interfaces:**
- **Consumes:** `decodeFrame`, `parseClientMessage`, `LIMITS`, `PROTOCOL` and types from D1-T2.
- **Produces:**
  - `loadConfig(env): Config`. Throws `Invalid gateway config: <path>: <message>; …`. Defaults: `PORT 8080`, `MODEL_MODE mock`, `GIT_SHA dev`, `LOG_LEVEL info`.
  - `class SessionHub`:
    - `new SessionHub({ send, handlers?, now? })`;
    - `id`, `locale`, `simRunId`;
    - `onText(raw: string): Promise<void>` and `onBinary(buf: Uint8Array): Promise<void>`.
  - `HubHandlers { onHello?(hello); onMessage?(msg, payload: Uint8Array | null) }`. Day 2 plugs the brain in here.
- **`SessionHub` rules (tests pin each one):**
  1. Text over `LIMITS.textBytes` (UTF-8 bytes) → `error{code:'bad_message'}`.
  2. Unparseable JSON → `bad_message`.
  3. `{type:'hello'}` with `protocol !== 'fp.v1'` → `error{code:'version_unsupported', say:'Please update Fingerpost to keep using it.'}`. This check runs **before** schema validation.
  4. Schema-invalid or unknown type → `bad_message`.
  5. `keyframe` or `audio` without a binary payload → `bad_message`; keyframe payload over `LIMITS.keyframeBytes` → `bad_message`.
  6. Any message before hello → `bad_message`.
  7. hello:
     - store `locale` and `caps.simRunId`;
     - call `handlers.onHello`;
     - send `ready{sessionId: hub.id, quota:{tasksLeft:30}, flags:{cloudEnabled:true, privateAvailable:false}}`.
  8. Everything else goes to `handlers.onMessage(msg, payload)`. If it throws, send `error{code:'model_unavailable', retryable:true, say:"I couldn't reach the reading service. Try again in a moment."}`.

  Every `error` has `retryable:false` unless rule 8 says otherwise; the default `say` is `Something went wrong talking to the server.` `id` comes from `ulid()` and `ts` from `now()`.

- [x] **Step 1: Copy.** `docs/superpowers/plans/assets/apply.sh 1 services/gateway && pnpm install`
- [x] **Step 2: Confirm red.** Run `pnpm --filter @fingerpost/gateway test app session`. The session and app tests fail with TODO(D1-T3).
- [x] **Step 3: Implement `loadConfig`.**
  - `Env.safeParse(env)`. On failure, throw `new Error('Invalid gateway config: ' + issues.map(i => \`${i.path.join('.')}: ${i.message}\`).join('; '))`.
  - Keep the `Env` schema exactly as given.
- [x] **Step 4: Implement `SessionHub`.** Follow rules 1–8 above, plus `private now()` and `private error(code, say?)`.
- [x] **Step 5: Confirm green.** Run `pnpm --filter @fingerpost/gateway test app session && pnpm --filter @fingerpost/gateway typecheck`. Expected: `app` 4 passed, `session` 10 passed.
- [x] **Step 6: Run it locally.**
  - `pnpm --filter @fingerpost/gateway dev`, then in another shell `curl -s localhost:8080/healthz`.
  - Expected: `{"status":"ok","version":"dev","protocol":"fp.v1"}`.
- [x] **Step 7: Build the container.** Verified 2026-10-28 with rootless Podman using the same Dockerfile; /healthz matches and runtime UID is 1000 (see progress.md). Docker or a compatible container runtime is required.
  - `docker build -f services/gateway/Dockerfile -t fp-gateway . && docker run --rm -d -p 8080:8080 --name fpg fp-gateway && sleep 2 && curl -s localhost:8080/healthz; docker rm -f fpg`
  - Expected: the same JSON.
  - The Dockerfile itself wasn't run during planning (no Docker daemon), but its exact pnpm steps were (filtered install, build, `deploy --legacy`, then `node dist/server.js` answering /healthz). Record any fix in progress.md.
- [x] **Step 8: Commit.**
  `git add services/gateway && git commit -m "feat(gateway): config, session hub, health, container"`

### Task D1-T4: Meta adapters (Spark screen parse, SAM 3.1 segmentation)
**Files:**
- **Skeletons:**
  - `src/parse/sam.ts`: `pickPrimaryMask`, `maskToPolygon`, `run`, `segmentByBox`, `segmentByText`;
  - `src/parse/spark-parse.ts`: `normalizeLabel`, `toLayout`, `parseScreen`.
- **Finished:**
  - `src/parse/geometry.ts`, which has the contour tracing, Douglas–Peucker and `normalizeSparkBox`. Don't rewrite it.
  - The `SparkScreen` schema, `SPARK_SCREEN_JSON_SCHEMA` and `prompts/parse-screen.v1.md`.
  - Tests: `test/{geometry,sam,spark-parse}.test.ts`, `test/fixtures/sam-*.events.json`, `test/fixtures/spark-parse.response.json`.

**Interfaces:**
- **Consumes:** `OpenAI` (openai 7.32.0); `@meta-sam/parser` exports `parseImageStream`, `recordsOfKind`, `decodeMaskToRaster`, `buildObjectPrompt` and types `SegmentationRecord`, `SegmentationMaskRecord`, `SegmentationBoxRecord`; geometry functions.
- **`sam.ts`, produces:**
  - `pickPrimaryMask(records)`:
    - highest confidence wins, using the mask's own `confidence`, else its box's (same `objectId`);
    - ties go to the larger bounds area;
    - `null` if there are no masks.
  - `maskToPolygon(mask, imageW, imageH)`:
    - The raster is **local to `mask.bounds`**: an image pixel is `(bounds.left + col, bounds.top + row)`.
    - Steps: `decodeMaskToRaster(m.mask)` → `rasterToPolygon(raster, m.mask.width, m.mask.height)` → `simplifyPolygon` → offset by bounds → `toUV`.
    - Fewer than 3 points → `null`.
  - `segmentByBox(client, image, box, events?)`:
    - Floor and clamp `left/top` to `[0, size−1]`; ceil and clamp `right/bottom` to `[left+1, size]`.
    - Build the prompt with `buildObjectPrompt({ size: {width, height}, objects: [{ id: 1, prompts: [{ box }] }] })`.
  - `segmentByText(client, image, phrase, events?)`: throws `SAM noun phrase must be 1–60 letters/digits/spaces: "<phrase>"` unless `/^[\p{L}\p{N} '-]{1,60}$/u` matches.
  - **The request** (the test pins this shape):
    ```ts
    client.responses.create({
      model: 'sam-3.1', stream: true,
      input: [{ role: 'user', content: [
        { type: 'input_text', text },
        { type: 'input_image', image_url: toDataUrl(image.bytes), detail: 'high' },
      ] }],
    })
    ```
    The returned stream is passed to `parseImageStream(stream).finalResult`.
    When `events` is given, use it instead of calling the client, and don't touch `client`.
  - **Result:** `{ polygon, confidence, latencyMs }`, with `latencyMs` rounded from `performance.now()` deltas.
- **`spark-parse.ts`, produces:**
  - `normalizeLabel(s)`: NFKC → lowercase → replace `/[\p{P}\p{S}]+/gu` with a space → collapse whitespace → trim. For example `'  ＰＡＹ — by Card! '` becomes `'pay by card'`.
  - `toLayout(SparkScreen)`:
    - Drop elements whose normalized box has `w` or `h` equal to 0, and elements with an empty trimmed label.
    - Ids are `e1, e2, …` in Spark's order, counting kept elements only.
    - The polygon is the 4 box corners TL, TR, BR, BL, each clamped to ≤ 1.
    - Confidence is clamped to [0,1].
    - Set `labelLocal` and `state` only when non-null; `textNorm = normalizeLabel(label)` when non-empty.
    - `language` is truncated to 16 characters, or `'und'` if empty.
  - `parseScreen(client, image, { locale, goal? })`:
    - **Request:**
      - `client.chat.completions.create({ model: 'muse-spark-1.3', messages, response_format: { type: 'json_schema', json_schema: { name: 'screen_layout', strict: true, schema: SPARK_SCREEN_JSON_SCHEMA } } })`.
      - `messages` = a system message with the prompt file, then a user message with two parts:
        1. text: `` `Locale for label_local: ${locale}.` `` plus `` ` The user wants to: ${goal}` `` when a goal is given;
        2. `{ type: 'image_url', image_url: { url: toDataUrl(bytes, mime) } }`.
    - Empty content → throw `Spark returned no content`. Then `SparkScreen.parse(JSON.parse(content))`.
    - Returns `{ layout: toLayout(...), usage: { inputTokens: prompt_tokens ?? 0, outputTokens: completion_tokens ?? 0 }, latencyMs, promptId: 'parse-screen.v1' }`.

- [x] **Step 1: Confirm red.** Run `pnpm --filter @fingerpost/gateway test sam spark-parse geometry`. Geometry should pass (15); sam and spark-parse fail with TODO(D1-T4).
- [x] **Step 2: Implement `sam.ts`.**
- [x] **Step 3: Implement `spark-parse.ts`.**
- [x] **Step 4: Confirm green.** Run `pnpm --filter @fingerpost/gateway test && pnpm --filter @fingerpost/gateway typecheck`. Expected: 43 passed in total.
- [x] **Step 5: Commit.**
  `git add services/gateway && git commit -m "feat(gateway): Spark screen parse + SAM 3.1 segmentation adapters"`

### Task D1-T5 (needs T0 keys and photos): live smoke, Cloud Run deploy, region latency (ADR-0003)
**Files:** supplied scripts: `services/gateway/scripts/smoke-meta.ts`, `scripts/latency-matrix.ts`, `src/debug/latency.ts`. Safe-output/input preparation adds tested runners and JPEG/metric validation. These files alone do not complete the live task. Create `infra/deploy-gateway.sh` (below). Modify `docs/adr/0003-cloud-run-region.md`.

**Safety preparation (verified 2026-10-28):** all photos under `evals/datasets/day1/` and `evals/datasets/private/` are ignored. Smoke preflights at least ten JPEG dimension headers before model calls. Only anonymous numerical outcomes go into `docs/evals/day1-smoke.md`; overlays stay in a unique ignored local run directory, with private file permissions. CLI errors never echo SDK response content. Regional diagnostics validate HTTP status and strict numerical responses, reject the placeholder image, and disable redirects. No live step below is complete from synthetic checks.

- [ ] **Step 1: Run the smoke test.** Run `set -a; source .env; set +a; pnpm --filter @fingerpost/gateway smoke` (costs about $0.01 per image).
  - Expected: `wrote docs/evals/day1-smoke.md` plus local `evals/datasets/private/day1-smoke/<run>/sample-*.svg` overlays. Never stage the overlays or dataset.
  - The numerical tables give Spark, SAM box and SAM text p50/p95, tokens per parse and estimated cost per image using the Day 1 planning rates; this is not measured billing.
- [ ] **Step 2: Inspect the private overlays.** Open each SVG locally in a browser. Blue is all Spark boxes, orange identifies the selected box prompt, and green is the SAM target. This preserves review context without putting recognized labels into Git.
  - Note in the report how many images have the green polygon on the right button. The goal is 8 of 10 or more.
  - If **Spark** is the problem (wrong boxes), write down the pattern. Don't edit the prompt today; Day 2 evals measure prompt changes.
- [x] **Step 3: Create `infra/deploy-gateway.sh`** (bash, `set -euo pipefail`). Prepared offline during the user-requested audit/fixes, with argument/clean-tree guards, five stubbed orchestration tests and shell syntax validation. No real cloud command has been executed. Args: `<project> <region>`. It runs:
  ```bash
  SHA=$(git rev-parse --short HEAD)
  IMAGE="$2-docker.pkg.dev/$1/fp/gateway:$SHA"
  gcloud builds submit . --project "$1" --region "$2" --config infra/cloudbuild.yaml --ignore-file .gcloudignore --substitutions "_IMAGE=$IMAGE"
  gcloud run deploy fingerpost-gateway --project "$1" --region "$2" --image "$IMAGE" \
    --timeout 3600 --concurrency 40 --min-instances 0 --max-instances 3 --allow-unauthenticated \
    --set-secrets META_API_KEY=meta-api-key:latest,DEBUG_TOKEN=debug-token:latest \
    --set-env-vars MODEL_MODE=live,GIT_SHA="$SHA",AUTH_REQUIRED=false,ALLOW_UNAUTHENTICATED_LIVE=true
  ```
  Then `chmod +x infra/deploy-gateway.sh`.
  - `AUTH_REQUIRED=false` plus `ALLOW_UNAUTHENTICATED_LIVE=true` hold only until Day 3 turns auth on (D3-T9 removes both). Day 1 and 2 configs ignore them; the Day 3 config refuses `AUTH_REQUIRED=false` in live mode without the second flag.
  - Current `gcloud builds submit` documents `--config`, not `--file`. `infra/cloudbuild.yaml` builds the specified Dockerfile and pushes the same revision-tagged image. `.gcloudignore` excludes secrets, captures and unrelated apps/docs from the source upload. No account, secret, registry or service is created by these local tests.
- [ ] **Step 4: Create the secrets** (dev project):
  ```bash
  printf %s "$META_API_KEY" | gcloud secrets create meta-api-key --data-file=- --project fingerpost-dev
  openssl rand -hex 24 | tr -d '\n' | gcloud secrets create debug-token --data-file=- --project fingerpost-dev
  ```
  Grant the default compute service account **Secret Manager Secret Accessor** on both secrets.
- [ ] **Step 5: Deploy to both candidate regions.**
  `infra/deploy-gateway.sh fingerpost-dev asia-south1 && infra/deploy-gateway.sh fingerpost-dev us-central1`
  Expected: two service URLs, and `curl <url>/healthz` returns ok on both.
- [ ] **Step 6: Measure.** Configure `LATENCY_GOAL` privately as one exact control label in the ignored latency crop, then run:
  `DEBUG_TOKEN=$(gcloud secrets versions access latest --secret debug-token --project fingerpost-dev) pnpm --filter @fingerpost/gateway latency:region <asiaUrl> <usUrl> --n 20`
  Expected: health RTT, gateway ASR upgrade/accepted-handshake, Spark/SAM phase and directly observed binary-keyframe-to-target p50/p95, plus SAM fallback counts. The same approved nonsensitive 1024×576 crop and exact goal must be used for both candidates, deployed at the same revision. The goal, token, image and model output stay out of public reports.
  - [x] **Offline measurement implementation:** token-protected ASR probe and single-use benchmark socket, schema-validated target/timing client and comparison CLI implemented test-first. All 143 gateway/205 TS tests, recursive typecheck/builds and compiled-gateway mock transport verification pass. No dependency or public fp.v1 schema/Kotlin model change. See docs/evals/day1-region-tooling.md.
  - `--n` accepts 1–20 samples; ranking requires 20 live samples in each candidate. Each connection/request is bounded to 60 seconds (initial diagnostic value). Failed HTTP/socket/model/schema exchanges abort without printing a partial comparison. Mock/short results cannot choose a region; equal totals produce a tie.
  - The `latency` command is retained for its fixed-box HTTP proxy, which is insufficient by itself. The new benchmark covers upload to validated target receipt for an exact-label rectified crop, excluding JPEG/session/goal setup and the unimplemented Android closed loop. This live Step 6 remains unchecked until the required measurements are actually run.
- [ ] **Step 7: Record the choice.** Follow ADR-0003: collect its required measurements and pick the lowest measured p50 total for keyframe → target. RTT+Spark alone is insufficient. Keep Status proposed while Voice Transcribe/total-flow evidence is missing. After acceptance, delete the losing service with `gcloud run services delete fingerpost-gateway --region <loser> --project fingerpost-dev`.
- [ ] **Step 8: Commit.**
  `git add infra docs/evals docs/adr && git commit -m "feat: live Meta smoke, Cloud Run deploy, region decision (ADR-0003)"`

### Task D1-T6: kiosk simulator v0 (`apps/web`)
**Files:** copy `apps/web`.
- **Skeletons:**
  - `src/sim/hit.ts` (`hitTest`);
  - `src/sim/log.ts` (`newRun`, `currentScreen`, `applyTouch`, `exportRun`, `labelsFor`).
- **Finished:**
  - `src/sim/{model,rng,layout,main}.ts` and `src/sim/scenes/{fastfood,pinpad}.ts`. Scenes and the RNG are fixed so eval labels are reproducible.
  - `index.html`, `sim/index.html`, `vite.config.ts`, `test/sim.test.ts`.

**Interfaces (Produces):**
- `hitTest(elements, x, y)`:
  - Scan from the **last** element to the first.
  - Skip `role === 'text'`.
  - A hit is `x ≥ rect.x && x < rect.x + rect.w`, and the same for y.
  - Returns the element or `null`.
- `newRun(runId, scene) → { runId, scene, screenId: scene.start, events: [] }`
- `currentScreen(state)`: the screen whose id is `state.screenId`.
- `applyTouch(state, {x, y, pointerId, ts}) → TouchEvent`:
  - always appends the event;
  - `u = clamp(x / CANVAS.w, 0, 1)`, and `v` likewise;
  - `elementId` is the hit's id or `null`;
  - then, if the hit's id is in `screen.next`, sets `state.screenId` to the target.
- `exportRun(state)`: `JSON.stringify({ runId, scene: scene.id, seed: scene.seed, events }, null, 2)`.
- `labelsFor(screen)`: `{id, label, role, u: x/CANVAS.w, v: y/CANVAS.h, w: w/CANVAS.w, h: h/CANVAS.h}` per element. This is the eval ground-truth format.

- [x] **Step 1: Copy and confirm red.** Run `docs/superpowers/plans/assets/apply.sh 1 apps/web && pnpm install && pnpm --filter @fingerpost/web test`. Expected: 7 failed, 7 passed.
- [x] **Step 2: Implement `hit.ts` and `log.ts`.**
- [x] **Step 3: Confirm green.** Run `pnpm --filter @fingerpost/web test && pnpm --filter @fingerpost/web build`. Expected: 14 passed; the build writes `dist/index.html` and `dist/sim/index.html`.
- [ ] **Step 4: Check on the tablet.** **Tablet acceptance pending (2026-10-28); desktop browser flow verified.**
  - Run `pnpm --filter @fingerpost/web dev` and open `http://<laptop-LAN-IP>:5173/sim/?scene=fastfood&seed=1` on the Android tablet.
  - The first tap requests fullscreen.
  - Walk home → menu → Drinks → Medium → Pay by card → done.
  - A 3-finger hold for 1.5 s opens the export panel. Check there's one event per tap, with element ids.
  - Also open `?scene=pinpad&layout=scrambled&seed=3`.
  - Record this in progress.md.
- [x] **Step 5: Commit.** Implementation committed as 4512cdb; tablet acceptance remains blocked.
  `git add apps/web && git commit -m "feat(web): kiosk simulator v0 (fast-food, PIN pad) with touch log and labels"`

### Task D1-T7a: Android Gradle project + `core:guidance` cue math
**Files:** copy `apps/android`. This brings the wrapper, `settings.gradle.kts`, `build.gradle.kts`, `gradle.properties`, `gradle/libs.versions.toml`, `core/guidance/**`, `app/build.gradle.kts` and `app/src/main/AndroidManifest.xml`.
- **Skeleton:** `core/guidance/.../Cues.kt` (`toneFrequencyHz`, `tonePan`, `magnitudeWord`).
- **Finished:** `OneEuroFilter.kt`, `CuesTest.kt`, `OneEuroFilterTest.kt`.
- **Not compiled in planning:** `app/build.gradle.kts` and the manifest (there was no SDK).

**Interfaces (Produces, guidance-spec §5 and §7):**
- `toneFrequencyHz(e) = 220 · 2^(3·(1 − min(max(e,0)/0.5, 1)))`
- `tonePan(ex) = clamp(ex / 0.3, −1, 1)`
- `magnitudeWord(e)`: `> 0.30 → A_LOT`; `≥ 0.10 → NONE`; `≥ 0.03 → A_LITTLE`; else `null`.

- [x] **Step 1: Copy.** `docs/superpowers/plans/assets/apply.sh 1 apps/android && chmod +x apps/android/gradlew`
- [x] **Step 2: Confirm red.** Run `cd apps/android && ./gradlew :core:guidance:test --console=plain`. Expected: 7 failures (CuesTest); OneEuroFilterTest passes.
  - If Gradle can't find a JDK 21, check `JAVA_HOME` (D1-T0).
  - `gradle.properties` turns on configure-on-demand, so this task doesn't configure `:app`.
- [x] **Step 3: Implement `Cues.kt`.**
- [x] **Step 4: Confirm green.** Run `./gradlew :core:guidance:test`. Expected: 12 tests pass.
- [x] **Step 5: Commit.**
  `git add apps/android && git commit -m "feat(android): gradle project, core:guidance cue math"`

### Task D1-T7b: app shell (Compose, TalkBack, camera permission)
**Files:** create the four files below. All are your code; they follow the snippets and must compile against the D1 `app/build.gradle.kts`.
- `app/src/main/kotlin/io/github/fingerpost/MainActivity.kt`
- `app/src/main/kotlin/io/github/fingerpost/ui/SessionScreen.kt`
- `app/src/main/kotlin/io/github/fingerpost/ui/Theme.kt`
- `app/src/main/res/values/strings.xml`

**Requirements:**
- `MainActivity : ComponentActivity`. It calls `enableEdgeToEdge()` and `setContent { FingerpostTheme { SessionScreen(...) } }`.
- It requests `Manifest.permission.CAMERA` with `rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission())`. If permission is denied:
  - show a full-screen message "Fingerpost needs the camera to see the screen you want to press.";
  - add a button "Open settings" that launches `Settings.ACTION_APPLICATION_DETAILS_SETTINGS` with `Uri.fromParts("package", packageName, null)`;
  - announce it with `view.announceForAccessibility(...)`.
- **Theme:** dark, high contrast (background `#000000`, text `#FFFFFF`, accent `#FFD400`), with large type (body 22 sp).
- **`SessionScreen` accessibility:** the whole screen is **one** TalkBack element:
  - `Modifier.fillMaxSize().semantics(mergeDescendants = true) { contentDescription = "Fingerpost camera. Double-tap to start or stop the tone." }.clickable { onToggle() }`.
- Strings live in `strings.xml`: `app_name`, `camera_needed`, `open_settings`, `session_description`.

- [x] **Step 1: Write the files** from the requirements.
- [x] **Step 2: Build.** Run `./gradlew :app:assembleDebug --console=plain`. Expected: BUILD SUCCESSFUL.
  - If AGP or Kotlin complain about the plugin setup, check AGENTS.md (built-in Kotlin: no `kotlin-android` plugin). Record any fix to `app/build.gradle.kts` under Deviations.
- [x] **Step 3: Check on the device.** All permission/TalkBack acceptance checks passed (2026-10-28); see docs/evals/day1-app-shell.md. Run `./gradlew :app:installDebug` with the phone connected and USB debugging on.
  - [x] Debug APK installed and MainActivity launched successfully.
  - [x] TalkBack enabled, verified through device accessibility settings (2026-10-28).
  - [x] Confirm the permission-denial message is spoken and Open settings reaches the app settings. User confirmed speech; app-details intent verified (2026-10-28).
  - [x] Grant camera permission, return to the app and confirm the expected black session screen with one TalkBack element. User confirmed; permission and resumed activity corroborated through ADB.
  - The app opens and asks for the camera.
  - Deny → the settings message is spoken with TalkBack on.
  - Allow → a black screen (the camera comes in T7c).
- [x] **Step 4: Commit.** Shell implementation and final device acceptance committed.
  `git commit -am "feat(android): Compose shell, TalkBack single action, camera permission"` (after `git add apps/android/app`)

### Task D1-T7c: CameraX + MediaPipe fingertip overlay + fps
**Files:**
- Create `app/src/main/kotlin/io/github/fingerpost/camera/CameraPipeline.kt`.
- Create `app/src/main/kotlin/io/github/fingerpost/vision/HandTracker.kt`.
- Performance follow-up: `camera/AnalysisFrame.kt`, `vision/TrackingOptions.kt`, JVM `AnalysisFrameTransform` + tests, and the optional `scripts/profile-android-tracking.py` diagnostic CLI + tests.
- Modify `ui/SessionScreen.kt`.
- Asset: download `app/src/main/assets/hand_landmarker.task` from `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`.
  - SHA-256 **`fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`**, 7 819 105 bytes.
  - Record both in `apps/android/ASSETS.md`.

**Interfaces (Produces):**
- `data class FingerSample(val tipX: Float, val tipY: Float, val dipX: Float, val dipY: Float, val presence: Float, val frameW: Int, val frameH: Int, val frameTsMs: Long, val inferenceMs: Long)`
  - Coordinates are pixels in the **upright** analysis frame.
- `class HandTracker(context: Context)`:
  - `val samples: StateFlow<List<FingerSample>>`, empty when there's no hand;
  - `fun submit(upright: Bitmap, tsMs: Long)`;
  - `fun close()`.
- `class CameraPipeline(context, lifecycleOwner, previewView: PreviewView, onFrame: (upright: Bitmap, tsMs: Long) -> Unit)`, with `start()` and `stop()`.
  - Performance follow-up preserves this callback and adds optional raw `AnalysisFrame` delivery. The tracker can combine crop, clockwise rotation and downscale directly into 640×480 without a full-size rotated intermediate, then publish the same upright sample coordinates. Distinct MediaPipe callback output images are closed; the reusable input image is retained until teardown.

**Implementation notes (APIs checked against MediaPipe 1.1.1 and CameraX 1.6):**
```kotlin
// CameraPipeline
val analysis = ImageAnalysis.Builder()
    .setResolutionSelector(ResolutionSelector.Builder().setResolutionStrategy(
        ResolutionStrategy(Size(1280, 720), ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER)).build())
    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
    .build()
analysis.setAnalyzer(executor) { proxy ->
    val rot = proxy.imageInfo.rotationDegrees
    val bmp = proxy.toBitmap()                         // CameraX ≥ 1.3
    val upright = if (rot == 0) bmp else Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, Matrix().apply { postRotate(rot.toFloat()) }, true)
    onFrame(upright, proxy.imageInfo.timestamp / 1_000_000)
    proxy.close()
}
ProcessCameraProvider.getInstance(context).get().bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)

// HandTracker
val options = HandLandmarker.HandLandmarkerOptions.builder()
    .setBaseOptions(BaseOptions.builder().setModelAssetPath("hand_landmarker.task").setDelegate(Delegate.GPU).build())
    .setRunningMode(RunningMode.LIVE_STREAM)
    .setNumHands(2)
    .setMinHandDetectionConfidence(0.5f).setMinHandPresenceConfidence(0.5f).setMinTrackingConfidence(0.5f)
    .setResultListener { result, _ -> /* result.landmarks()[i][8], [7]: normalized x(), y() → multiply by frameW/H */ }
    .setErrorListener { e -> /* fall back to Delegate.CPU once */ }
    .build()
val landmarker = HandLandmarker.createFromOptions(context, options)
// submit(): scale the upright frame to 640 px wide (keep aspect), then
landmarker.detectAsync(BitmapImageBuilder(scaled).build(), tsMs)   // timestamps must increase
```
- **Presence:** comes from `result.handedness()[i][0].score()`.
- **Fallback:** if GPU creation throws, recreate with `Delegate.CPU` and log once.
- **Overlay:** a Compose `Canvas` over the `PreviewView` (`AndroidView`). Draw a 14 dp yellow circle at the tip of each sample, scaled from frame px to view px with the same `FILL_CENTER` math the preview uses.
- **Debug text:** a top-left label `"%d fps · %d ms".format(fps, inferenceMs)`, where fps is a 1-second moving count of results. Mark it `invisibleToUser()` for TalkBack.

- [x] **Step 1: Add the model asset** and check its checksum: `shasum -a 256 app/src/main/assets/hand_landmarker.task`. Verified pinned SHA-256 and 7,819,105 bytes on 2026-10-28; recorded in apps/android/ASSETS.md.
- [x] **Step 2: Implement** `CameraPipeline`, `HandTracker` and the overlay. Uses guidance-spec §3's 640×480 aspect-preserving letterbox; six projection and seven fused-transform tests added red-first. All 25 JVM tests and 18 numeric-tool tests pass. Build and lint pass; the visible app window keeps the screen awake, including the permission screen.
- [x] **Step 3: Build and install.** Run `./gradlew :app:installDebug`. Final fused/keep-awake APK installed and launched successfully on the comparison test phone on 2026-10-28; multiple-device install used privately targeted adb.
  - Audit follow-up: tracking CLI acceptance now requires GPU/two hands, awake-state evidence and sufficient logged windows; 22 synthetic tracking-tool tests pass and run in CI. No production detector setting or performance threshold changed. No device was connected for new acceptance checks.
- [ ] **Step 4: Check on the device.**
  - [x] The original overlay follows the index fingertip in portrait and landscape and disappears when the hand leaves view. User confirmed on 2026-10-28. Fused-build regression confirmation remains pending below.
  - [ ] The label shows ≥ 25 fps and ≤ 25 ms inference on the Android phone.
  - [x] Record a generic phone label, fps and ms in `docs/evals/day1-device.md` (user privacy requirement).
  - [ ] Recheck visual following/disappearance in both orientations and the single TalkBack element after the fused-pipeline change. User postponed this check during the later USB reconnect.
  - USB reconnect follow-up: corrected shell transport completes both full diagnostic windows; all 24 tracking-tool +5 deployment-tool tests pass. GPU/one hand reaches 9–12 FPS / 52–109 ms (intermittent hand loss), GPU/two hands 5–8 FPS / 107–167 ms (rolling max 167 ms; budget false). Both report thermal status 3, so a cold baseline is still missing.
  - **Blocked (2026-10-28):** original runs missed the target. Resumed tests on a comparison phone still fail: CPU/two hands 11–14 fps / 45–61 ms with no hands; GPU/two hands 10–12 fps / 43–86 ms with a pointing hand consistently detected. Production stays GPU/two hands. See docs/evals/day1-tracking-profile.md and progress Blockers. User subsequently explicitly authorized T7d while leaving this task unfinished (exception below).
- [ ] **Step 5: Commit.**
  `git add apps/android && git commit -m "feat(android): CameraX + MediaPipe fingertip overlay with fps"`
  - Implementation and performance-investigation checkpoints are saved separately; this completion step remains open until device acceptance passes.

### Task D1-T7d: tone prototype
**Dependency exception (2026-10-28):** user explicitly deferred unfinished T7c and requested T7d. T7c remains blocked; its open checks and the Day 1 exit gate are unchanged.

**Files:**
- Create `app/src/main/kotlin/io/github/fingerpost/audio/ToneSynth.kt`.
- Modify `SessionScreen.kt`.

**Interfaces (Produces):** `class ToneSynth` with:
- `start()`, `stop()`, `release()`;
- `setFrequency(hz: Double)` and `setPan(pan: Double)`. Both are thread-safe and take effect within 5 ms using a linear ramp.

**Implementation notes:**
```kotlin
val track = AudioTrack.Builder()
    .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
    .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_FLOAT).setSampleRate(48_000).setChannelMask(AudioFormat.CHANNEL_OUT_STEREO).build())
    .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
    .setTransferMode(AudioTrack.MODE_STREAM)
    .setBufferSizeInBytes(AudioTrack.getMinBufferSize(48_000, AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_FLOAT))
    .build()
```
- **Generator thread:** writes 240-frame (5 ms) stereo `FloatArray` blocks with `track.write(buf, 0, buf.size, AudioTrack.WRITE_BLOCKING)`.
- **Phase:** keep a phase accumulator, so changing the frequency doesn't click.
- **Panning:** equal-power, with `l = cos((pan+1)·π/4)` and `r = sin((pan+1)·π/4)`.
- **Amplitude:** 0.25.
- **Prototype mapping:** `setFrequency(toneFrequencyHz(1.0 - tipX / frameW))` and `setPan(tonePan((tipX / frameW - 0.5) * 0.6))`. Double-tapping the screen (the TalkBack action) toggles start/stop.

- [x] **Step 1: Implement** `ToneSynth` and wire it into the screen. Twelve oscillator/mapping tests confirmed TODO failures before implementation; all 37 guidance tests, app:test (no source cases), debug build and lint pass. No dependency changes. Audio controls use an atomic snapshot and a dedicated audio thread; invalid/no-hand tracking mutes output and lifecycle stop releases it.
- [x] **Step 2: Check on the device.** User confirmed all required checks on 2026-10-28; see docs/evals/day1-tone.md.
  - [x] Pitch rises as image x increases (finger moves right in the preview) and pans with it, matching the explicit prototype formula above. User confirmed tone/pitch/stereo pan on 2026-10-28.
  - [x] No clicks. User confirmed clean toggles and changes.
  - [x] With TalkBack on, double-tap toggles the tone. User confirmed; TalkBack-enabled state corroborated through ADB.
  - [x] Note the latency you feel in `docs/evals/day1-device.md`. User reports prompt response; no acoustic millisecond measurement claimed.
- [x] **Step 3: Commit.** Implementation saved in 1e51a15; final device acceptance recorded separately. T7c remains unfinished under the explicit dependency exception.
  `git add apps/android && git commit -m "feat(android): low-latency tone prototype driven by the fingertip"`

### Task D1-T8: CI green + lane-C docs
**Prerequisite correction (2026-10-28):** CI already requires `:core:protocol:test`. Execute the existing D2-T1 protocol foundation, using its original checklist in the Day 2 plan, before claiming T8. This resolves the forward dependency without starting the other Day 2 tasks or removing a CI check. T7c remains unfinished under the user's deferral. T8 drafts precede the human outreach item in T0.

**Files:**
- `.github/workflows/ci.yml` (copied in T1).
- Create `.github/dependabot.yml`, `docs/tester-protocol.md`, `docs/consent-form.md`, `docs/outreach.md`, `docs/testers.md`.

- [x] **Step 1: Write `dependabot.yml`.** Weekly updates for `npm` (directory `/`), `gradle` (`/apps/android`) and `github-actions` (`/`). YAML/schema fields checked; proposals still require human review under AGENTS.md's pinned-version rules.
- [x] **Step 2: Write `docs/tester-protocol.md`.** Corrected agenda totals 45 minutes; prerequisites and actual simulator in-memory recording behavior are explicit.
  - **Format:** a 45-minute session, either in person or on a video call with the tester's own Android phone.
  - **Agenda:**
    - consent, 5 min;
    - onboarding, 5 min;
    - 3 single-target tasks on the appliance and sim, 15 min;
    - from Day 4: a multi-step sim task, 10 min;
    - PIN-pad exploration on the sim, 5 min;
    - interview, 5 min (corrected from 10 so the full agenda totals 45).
  - **What we record:** sim run ids (metrics come from those logs), interview notes, and quotes only with explicit consent.
  - **Proxies:** blindfolded teammates are labeled `proxy` and never counted as blind-user results.
- [x] **Step 3: Write `docs/consent-form.md`.** English and Hindi; headings/short paragraphs/no tables; separate participation, metrics, notes, quote and credit choices. Contact is a private reply to the human inviter, confirmed before enrollment; no personal contact details added to Git. It says:
  - taking part is voluntary, and you can stop at any time;
  - no real payments are made;
  - nothing is recorded unless you say yes separately;
  - you're credited by name only if you want to be;
  - a contact for questions.
- [x] **Step 4: Write `docs/outreach.md`.** English/Hindi DM: 71/75 words; email: 170/192; Reddit draft: 178/197. All within limits and explicit about unfinished features. Current r/Blind rules exclude this recruitment; draft retained but marked do not post. Nothing sent.
  - Targets: NAB, NFB India, Saksham, XRCVC, Enable India, Mitra Jyothi, college disability cells, r/Blind, RNIB forums, NFB US.
- [x] **Step 5: Write `docs/testers.md`.** Organization/channel, date sent, status and next step only. All unsent; r/Blind marked blocked. No personal data or invented outreach/test results.
- [x] **Step 6: Push and watch CI.** Committed as 9102c2c (`ci(docs): add Dependabot and tester preparation`); run 40616176301 is successful for both ts and android. Watched with `gh run watch 40616176301 --interval 15 --exit-status`; all original test/build steps retained.
  - Expected: `ts` and `android` jobs green.
  - The `android` job needs T7b's app code; if T7b isn't merged yet, it fails on `:app:assembleDebug`. Re-run after T7b.

---

## Day 1 exit check (23:00 IST): record results in `docs/progress.md`
1. T7c: fingertip at 25 fps or more on the Android phone.
2. T5 Step 2: correct target polygons on 8 or more of 10 real panel photos.
3. T5 Step 7: ADR-0003 accepted.
4. T6 Step 4: the sim runs on the tablet.
5. T8 Step 6: CI green.

Anything missed goes to tomorrow's 10:00 stand-up for cut decisions (design §1 cut order).
