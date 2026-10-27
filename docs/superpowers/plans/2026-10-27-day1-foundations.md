# Day 1 (Tue Oct 27) Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the monorepo and kill Day 1's unknowns. By tonight we have:
- a live fingertip dot on Android;
- a real Spark + SAM 3.1 parse of a real panel photo, with latency and cost numbers;
- the kiosk simulator v0 running on the tablet;
- CI green.

**Architecture:** A pnpm monorepo of TS packages (`packages/protocol`, `services/gateway`, `apps/web`) plus a Gradle project (`apps/android`). The protocol package is the contract: zod schemas plus golden JSON fixtures that both TS and Kotlin tests parse. The gateway talks to the Meta Model API through the OpenAI SDK, and SAM output is parsed with `@meta-sam/parser`.

**Tech Stack:**
- **TS side:** Node 24.18, pnpm, TypeScript 7.0.2, zod 4.6.7, Fastify 5.12.7, @fastify/websocket 11.3.4, openai 7.45.0, @meta-sam/parser 0.1.0, vitest 5.0.5, vite 8.3.5, pino 10.4.0, ulid 3.0.2.
- **Android side:** AGP 9.4.1, Gradle 9.8.2, Kotlin 2.4.21, Compose BOM 2026.09.00, activity-compose 1.13.0, CameraX 1.6.2, MediaPipe tasks-vision 1.1.1, JUnit 6.1.3.

**Spec:**
- `docs/design.md` (§4, §5, §7 Day 1)
- `docs/guidance-spec.md`
- `docs/protocol.md`
- `docs/adr/`

Lanes are parallel: Tasks 2–5 belong to lane B, Task 6 to C, Task 7 to A. Tasks 1 and 8 are shared.

## Global Constraints
- **License:** Apache-2.0. Every source file needs no header; the root `LICENSE` covers it.
- **Package/app id:** `io.github.fingerpost`, minSdk 29, target/compile SDK 36.
- **Protocol:** id `fp.v1`. Binary frame `[u32 big-endian headerLen][UTF-8 JSON header][payload]`.
- **Message limits:**
  - text ≤ 16 KB;
  - keyframe payload ≤ 400 KB;
  - header ≤ 16 KB.
- **Meta API:**
  - base URL `https://api.meta.ai/v1`;
  - models `muse-spark-1.3` and `sam-3.1`;
  - Voice Transcribe `wss://api.meta.ai/v1/asr/realtime`.
  - **Standard mode only**: never a `-contributor` model id.
- **Coordinates:**
  - Spark grounding returns a 0–1000 grid (it may exceed it, so clamp).
  - Screen space is normalized `u, v ∈ [0,1]`.
  - Polygons have at most 32 points.
- **Secrets:** `META_API_KEY` never in git and never in the APK. Local `.env` is gitignored. Cloud Run reads it from Secret Manager secret `meta-api-key`.
- **Logs:** never log image bytes, audio, transcripts or OCR text. Only ids, sizes, latencies and outcomes.
- **Privacy:** Day 1 smoke images are team-captured appliance photos only.

## Review Focus
1. **Spark boxes outside 0–1000 or with min > max** should be clamped and re-ordered, never thrown. Covered by Task 4, `normalizeSparkBox`.
2. **SAM returns zero objects (empty `output_text`) or several objects for one box prompt.** The result should be `null`, or the highest-confidence/largest object, without crashing. Covered by Task 4, `pickPrimaryMask`.
3. **A malformed binary frame** (headerLen > buffer, non-UTF-8 header, payload over 400 KB) should be rejected with `bad_message` while the socket stays usable. Covered by Tasks 2 and 3.
4. **Unknown message `type` or extra fields from a newer peer:**
   - The client parse returns `{kind:'unknown'}`, which callers ignore.
   - The server answers an unknown client type with `bad_message`.
   - Covered by Tasks 2 and 3.
5. **Sim touches on gaps between buttons, multi-touch, and rapid double-taps** are each logged, with `elementId: null` for misses. None are dropped. Covered by Task 6, `hitTest` and `recordTouch`.

---

### Task 0 (human, all three, first two hours): accounts and tooling
These steps need the user's credentials or downloads. Claude can generate a step-by-step wizard script for them (the `wizard` skill).

- [ ] **Android tooling:**
  - `brew install --cask android-studio`; open it once and install SDK Platform 36 plus Build-Tools.
  - `brew install gradle` (only to generate the wrapper).
  - Verify: `~/Library/Android/sdk/platform-tools/adb version` prints a version, and `"/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java" -version` prints 21.
- [ ] **Meta Model API:**
  - Create a key and claim the $150 credits.
  - Put it in `fingerpost/.env` as `META_API_KEY=...`.
  - Verify: `curl -s https://api.meta.ai/v1/models -H "Authorization: Bearer $META_API_KEY" | head -c 300` lists `muse-spark-1.3`.
- [ ] **Modal:** claim the credits (first 1,000 people). Also apply to Baseten as a backup.
- [ ] **GCP:**
  - `gcloud projects create fingerpost-dev` and `fingerpost-prod`, then link billing.
  - Enable `run`, `cloudbuild`, `artifactregistry`, `secretmanager`, `firestore`.
  - Add Firebase to both projects.
  - Budget alerts at $1, $5 and $10.
  - Verify: `gcloud projects list | grep fingerpost` shows both.
- [ ] **GitHub:**
  - Create the org or repo `fingerpost` (public). `gh` is logged in as `Sky-walkerX`.
  - Verify: `gh repo view <owner>/fingerpost`.
- [ ] **Name checks:** the X handle (@fingerpost, or @fingerpostapp), and the package id `io.github.fingerpost`. The package id works only if the GitHub org is `fingerpost`. Otherwise use `io.github.<owner>.fingerpost` and update Global Constraints.
- [ ] **Tester outreach:** send the messages from Task 8 to 10 or more groups. Log them in `docs/testers.md` (no personal data in git: names as initials only).

### Task 1: Monorepo root

**Files:**
- Create: `LICENSE` (Apache-2.0 full text), `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1)
- Create: `.gitignore` (node_modules, dist, .env*, *.keystore, local.properties, .gradle, build, .idea, evals/datasets/private/**)
- Create: `.editorconfig`, `.nvmrc` (`24`)
- Create: `pnpm-workspace.yaml` (`packages/*`, `services/*`, `apps/web`, `evals`)
- Create: `package.json` (private; scripts `typecheck`, `test`, `build` running `pnpm -r`)
- Create: `tsconfig.base.json` (strict, `module`/`moduleResolution` `nodenext`, `target es2024`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)

**Interfaces:**
- Produces: workspace layout that later tasks drop packages into, and `tsconfig.base.json`, which every TS package extends.

- [ ] **Step 1: Create the files.** The README holds the one-liner, a status badge placeholder, the repo map from design §6, and links to docs. SECURITY.md gives a contact email placeholder plus "do not file public issues for vulnerabilities".
- [ ] **Step 2: Verify.** Run `pnpm install && pnpm -r test`. Expected: exit 0 ("No projects matched" is fine).
- [ ] **Step 3: Commit.**
  `git add -A && git commit -m "chore: monorepo root, Apache-2.0, workspace config"`
- [ ] **Step 4: Push.**
  `git remote add origin git@github.com:<owner>/fingerpost.git && git push -u origin main` (after Task 0).

### Task 2: `packages/protocol`: zod schemas, binary framing, fixtures

**Files:**
- Create: `packages/protocol/package.json` (name `@fingerpost/protocol`, `type: module`, exports `./dist/index.js`; build `tsc -b`)
- Create: `packages/protocol/src/common.ts`
  - `Point = {x,y}` (image px);
  - `UV = {u,v}`, each a 0–1 float with an 0.15 overshoot allowed only on `UV`, not on polygons;
  - `Polygon = UV[]` of length 3–32;
  - `Locale = 'en'|'hi'|'es'`;
  - `Priority`.
- Create: `packages/protocol/src/client.ts`. `ClientMessage` is a discriminated union on `type` covering every client→server row in `docs/protocol.md`, each with an `id` (ULID string) and `ts` (int).
- Create: `packages/protocol/src/server.ts`. `ServerMessage` covers every server→client row and the `ErrorCode` enum from `docs/protocol.md`.
- Create: `packages/protocol/src/frame.ts`. Binary framing.
- Create: `packages/protocol/src/index.ts`. Re-exports, plus `PROTOCOL = 'fp.v1'` and `LIMITS = {textBytes: 16384, headerBytes: 16384, keyframeBytes: 409600}`.
- Create: `packages/protocol/scripts/export-json-schema.ts`. Writes `schema/client.json` and `schema/server.json` via `z.toJSONSchema`.
- Create: `packages/protocol/fixtures/valid/*.json`. At least one file per message type, named `<direction>.<type>.json`, e.g. `server.layout.json` with 3 elements, one of them `role: "pay"`.
- Create: `packages/protocol/fixtures/invalid/*.json`:
  - `client.keyframe.no-imageSize.json`
  - `server.target.polygon-too-long.json` (33 points)
  - `server.layout.bad-screenType.json`
  - `client.hello.wrong-protocol.json`
- Test: `packages/protocol/test/fixtures.test.ts`, `packages/protocol/test/frame.test.ts`

**Interfaces:**
- **Produces:**
  - `parseClientMessage(json: unknown): {ok: true, msg: ClientMessage} | {ok: false, error: string}`. Unknown `type` → `ok:false`.
  - `parseServerMessage(json: unknown): {kind: 'ok', msg: ServerMessage} | {kind: 'unknown', type: string} | {kind: 'invalid', error: string}`. Unknown `type` → `unknown`. Unknown fields are stripped, not rejected.
  - `encodeFrame(header: object, payload: Uint8Array): Uint8Array`
  - `decodeFrame(buf: Uint8Array): {ok: true, header: unknown, payload: Uint8Array} | {ok: false, error: 'short'|'header_too_large'|'header_not_utf8'|'header_not_json'}`
  - Types `ClientMessage`, `ServerMessage`, `Layout`, `LayoutElement`, `ElementRole`, `ScreenType`, `ErrorCode`.

- [ ] **Step 1: Write the failing tests.**

```ts
// test/fixtures.test.ts
import { readdirSync, readFileSync } from 'node:fs';
const load = (d: string) => readdirSync(`fixtures/${d}`).map(f => [f, JSON.parse(readFileSync(`fixtures/${d}/${f}`, 'utf8'))] as const);
test.each(load('valid'))('valid %s parses and round-trips', (name, json) => {
  const r = name.startsWith('client.') ? parseClientMessage(json) : parseServerMessage(json);
  expect('ok' in r ? r.ok : r.kind).toBe(name.startsWith('client.') ? true : 'ok');
  const msg = 'msg' in r ? r.msg : undefined;
  expect(JSON.parse(JSON.stringify(msg))).toEqual(msg);
});
test.each(load('invalid'))('invalid %s is rejected', (name, json) => {
  const r = name.startsWith('client.') ? parseClientMessage(json) : parseServerMessage(json);
  expect('ok' in r ? r.ok : r.kind).toBe(name.startsWith('client.') ? false : 'invalid');
});
test('every message type has a valid fixture', () => { /* compare union discriminants to fixture names */ });
test('unknown server type is ignorable', () => {
  expect(parseServerMessage({ type: 'future.thing', id: 'x', ts: 1 })).toEqual({ kind: 'unknown', type: 'future.thing' });
});
test('extra fields are stripped from server messages', () => { /* add field "zzz" to say fixture → ok, msg has no zzz */ });
```

```ts
// test/frame.test.ts
test('round-trips header and payload', () => {
  const f = encodeFrame({ type: 'keyframe', id: 'a', ts: 1 }, new Uint8Array([1, 2, 3]));
  const d = decodeFrame(f);
  expect(d.ok && [...d.payload]).toEqual([1, 2, 3]);
});
test('headerLen larger than buffer → short', () => { expect(decodeFrame(new Uint8Array([0, 0, 1, 0, 123]))).toEqual({ ok: false, error: 'short' }); });
test('header over 16384 bytes → header_too_large', () => { /* u32 = 16385 */ });
test('non-UTF-8 header → header_not_utf8', () => { /* bytes 0xff 0xfe */ });
test('buffer under 4 bytes → short', () => { expect(decodeFrame(new Uint8Array([0, 0]))).toEqual({ ok: false, error: 'short' }); });
```

- [ ] **Step 2: Run them and confirm they fail.** `pnpm --filter @fingerpost/protocol test`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement the schemas, `parse*`, and `encodeFrame`/`decodeFrame`.**
  - Use `z.discriminatedUnion('type', [...])`.
  - Decode with `new TextDecoder('utf-8', {fatal: true})`.
  - Payload size limits are enforced by the gateway (Task 3), not by `decodeFrame`.
- [ ] **Step 4: Write the fixtures** so they mirror `docs/protocol.md` examples exactly.
- [ ] **Step 5: Run the tests and confirm they pass.** `pnpm --filter @fingerpost/protocol test`. Expected: PASS.
- [ ] **Step 6: Export the JSON Schema.** Run `pnpm --filter @fingerpost/protocol exec tsx scripts/export-json-schema.ts`. Expected: `schema/client.json` and `schema/server.json` exist.
- [ ] **Step 7: Commit.**
  `git commit -am "feat(protocol): fp.v1 schemas, binary framing, golden fixtures"` (after `git add packages/protocol`)

### Task 3: `services/gateway` skeleton: config, health, session hello/ready, container

**Files:**
- Create: `services/gateway/package.json` (name `@fingerpost/gateway`; deps fastify, @fastify/websocket, zod, pino, ulid, `@fingerpost/protocol: workspace:*`)
- Create: `services/gateway/src/config.ts`. Env schema:
  - `PORT` default 8080;
  - `MODEL_MODE` `mock|live`, default `mock`;
  - `META_API_KEY`, required when `live`;
  - `DEBUG_TOKEN`, optional;
  - `GIT_SHA`, default `dev`.
- Create: `services/gateway/src/app.ts`.
- Create: `services/gateway/src/session/hub.ts`.
- Create: `services/gateway/src/server.ts` (listen).
- Create: `services/gateway/Dockerfile`. Multi-stage on `node:24-slim`; the build context is **the repo root**; uses `pnpm deploy --filter @fingerpost/gateway --prod /out`; runs as non-root `node`; `CMD ["node","dist/server.js"]`.
- Create: `.dockerignore` (repo root).
- Test: `services/gateway/test/app.test.ts`, `services/gateway/test/session.test.ts`

**Interfaces:**
- **Consumes:** `parseClientMessage`, `decodeFrame` and `LIMITS` from Task 2.
- **Produces:**
  - `loadConfig(env: NodeJS.ProcessEnv): Config`. Throws a readable error listing the missing keys.
  - `buildApp(cfg: Config): Promise<FastifyInstance>`.
  - Route `GET /healthz` → `{status:'ok', version: cfg.GIT_SHA, protocol:'fp.v1'}`.
  - WS route `/v1/session`.
  - `handleClientText(session: Session, raw: string): ServerMessage[]`
  - `handleClientBinary(session: Session, buf: Uint8Array): ServerMessage[]`
  - On Day 1 `hello` → `ready{sessionId, quota:{tasksLeft:30}, flags:{cloudEnabled:true, privateAvailable:false}}`; anything else → `error{code:'bad_message'}` or a no-op.
- **Logging:** pino, with `redact: ['req.headers.authorization']`. The hub logs only `type`, `bytes` and `sessionId`.

- [ ] **Step 1: Write the failing tests.**

```ts
// test/app.test.ts
test('healthz reports protocol', async () => {
  const app = await buildApp(loadConfig({ MODEL_MODE: 'mock' }));
  const r = await app.inject('/healthz');
  expect(r.json()).toMatchObject({ status: 'ok', protocol: 'fp.v1' });
});
test('live mode without META_API_KEY fails with a readable error', () => {
  expect(() => loadConfig({ MODEL_MODE: 'live' })).toThrow(/META_API_KEY/);
});
```

```ts
// test/session.test.ts  (pure handler tests, no socket)
test('hello → ready', () => { const out = handleClientText(newSession(), JSON.stringify(helloFixture)); expect(out[0]?.type).toBe('ready'); });
test('unknown client type → bad_message, session stays open', () => { /* {type:'nope'} → error.code === 'bad_message' */ });
test('text over 16384 bytes → bad_message', () => { /* 'x'.repeat(16385) */ });
test('binary with headerLen > buffer → bad_message', () => {});
test('keyframe payload over 409600 bytes → bad_message', () => {});
test('message before hello → bad_message', () => {});
```

- [ ] **Step 2: Run them and confirm they fail.** `pnpm --filter @fingerpost/gateway test`. Expected: FAIL.
- [ ] **Step 3: Implement** `loadConfig` (zod over env), `buildApp`, and the hub handlers.
  - The WS route calls the handlers and `socket.send`s each reply. Binary replies are never sent on Day 1.
  - `Session` has `{id, helloed: boolean, locale?}`.
- [ ] **Step 4: Run the tests and confirm they pass.** `pnpm --filter @fingerpost/gateway test`. Expected: PASS.
- [ ] **Step 5: Verify the container.**
  - `docker build -f services/gateway/Dockerfile -t fp-gateway . && docker run -d -p 8080:8080 --name fpg fp-gateway`
  - `curl -s localhost:8080/healthz`. Expected: `{"status":"ok",...}`.
  - `docker rm -f fpg`.
- [ ] **Step 6: Commit.**
  `git add services/gateway .dockerignore && git commit -m "feat(gateway): config, healthz, session hello/ready, container"`

### Task 4: Meta model adapters: Spark screen parse, SAM box/text segment, mask→polygon

**Files:**
- Create: `services/gateway/src/models/meta-client.ts`. `createMetaClient(apiKey: string): OpenAI` with `baseURL 'https://api.meta.ai/v1'`.
- Create: `services/gateway/src/parse/spark-parse.ts`
- Create: `services/gateway/src/parse/sam.ts`
- Create: `services/gateway/src/parse/geometry.ts`
- Create: `services/gateway/prompts/parse-screen.v1.md`. The system prompt for screen parsing.
  - Lists the roles and screenTypes from the protocol.
  - Instructs: boxes on the 0–1000 grid; label exactly as printed; `labelLocal` in the requested locale; mark pay/confirm/submit roles; `pin_pad` when a 0–9 keypad dominates.
- Create: `services/gateway/test/fixtures/` with:
  - `spark-parse.response.json`: a recorded or handwritten Chat Completions response;
  - `sam-box.events.json`: an array of Responses stream events, with output text in the README format and 2 objects;
  - `sam-empty.events.json`.
- Test: `services/gateway/test/geometry.test.ts`, `services/gateway/test/spark-parse.test.ts`, `services/gateway/test/sam.test.ts`

**Interfaces:**
- **Consumes:** `Layout`, `LayoutElement`, `Polygon` and `ScreenType` types from Task 2.
- **Produces:**
  - `normalizeSparkBox(b: {x_min:number,y_min:number,x_max:number,y_max:number}): {u:number,v:number,w:number,h:number}`. Clamps each value to [0,1000], swaps min and max if reversed, divides by 1000.
  - `parseScreen(client: OpenAI, image: {bytes: Uint8Array, mime: 'image/jpeg'}, opts: {locale: Locale, goal?: string}): Promise<{layout: Omit<Layout,'fingerprint'|'source'>, usage: {inputTokens:number, outputTokens:number}, latencyMs:number}>`
    - Calls Chat Completions on `muse-spark-1.3` with `response_format: {type:'json_schema', json_schema:{name:'screen_layout', strict:true, schema}}`, where the schema comes from `z.toJSONSchema` of a Spark-side zod schema.
    - The image goes as a data URL in `image_url`.
    - Element polygons are the 4 corners of the normalized box.
  - `segmentByBox(client, image: {bytes, width, height}, box: {left,top,right,bottom} /*px*/): Promise<{polygon: Polygon|null, confidence: number|null, latencyMs: number}>`
    - Calls Responses with `model:'sam-3.1'`, `stream:true`, and input `[{role:'user', content:[{type:'input_text', text: buildObjectPrompt({size, objects:[{id:1, prompts:[{box}]}]})}, {type:'input_image', image_url: dataUrl}]}]`.
    - Parsed with `parseImageStream(stream).finalResult`, then `pickPrimaryMask`, then `rasterToPolygon`, then normalized by image size.
  - `segmentByText(client, image, phrase: string): Promise<...same>`. Takes a noun phrase, e.g. `"touchscreen display"`.
  - `pickPrimaryMask(records): MaskRecord|null`. Highest box confidence `c`; ties go to the largest area; null if there are none.
  - `rasterToPolygon(raster: Uint8Array, w: number, h: number): Array<{x:number,y:number}>`. Outer contour of the largest 4-connected component, by Moore-neighbour tracing; `[]` if the raster is empty.
  - `simplifyPolygon(pts, maxPoints = 32): pts`. Douglas–Peucker, starting at ε = 0.5 px and doubling ε until the length is ≤ maxPoints. Always ≥ 3 points when the input has ≥ 3.

- [ ] **Step 1: Write the failing tests.**

```ts
// test/geometry.test.ts
test('normalizeSparkBox clamps and reorders', () => {
  expect(normalizeSparkBox({ x_min: 1010, y_min: 500, x_max: 900, y_max: -5 })).toEqual({ u: 0.9, v: 0, w: 0.1, h: 0.5 });
});
test('rasterToPolygon of a filled 10×10 square inside 20×20 has ~4 corners after simplify', () => {
  const r = squareRaster(20, 20, 5, 5, 10); const p = simplifyPolygon(rasterToPolygon(r, 20, 20));
  expect(p.length).toBeGreaterThanOrEqual(4); expect(p.length).toBeLessThanOrEqual(8);
});
test('rasterToPolygon keeps the largest component only', () => { /* two blobs, assert bbox of result == bigger blob */ });
test('rasterToPolygon of empty raster is []', () => { expect(rasterToPolygon(new Uint8Array(400), 20, 20)).toEqual([]); });
test('simplifyPolygon never exceeds 32 points', () => { /* circle raster r=200 → ≤32 */ });
```

```ts
// test/sam.test.ts — feed recorded events through the same code path via an injected event source
test('two objects → picks the higher-confidence one', async () => {});
test('empty output → polygon null, no throw', async () => {});
// test/spark-parse.test.ts
test('recorded response → layout with normalized polygons and screenType', async () => {});
test('pay-role element survives parsing', async () => {});
```

Testability: `segmentByBox` and `segmentByText` take an optional `events?: AsyncIterable<ResponsesEvent>` override. `parseScreen` takes a `client` that the test stubs with `{chat:{completions:{create: async () => fixture}}}`.

- [ ] **Step 2: Run them and confirm they fail.** `pnpm --filter @fingerpost/gateway test -- geometry spark sam`. Expected: FAIL.
- [ ] **Step 3: Implement** `geometry.ts`, then `sam.ts`, then `spark-parse.ts` (in that order).
- [ ] **Step 4: Run the tests and confirm they pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.**
  `git add services/gateway && git commit -m "feat(gateway): Spark screen parse + SAM 3.1 box/text segmentation adapters"`

### Task 5: Live smoke, Cloud Run deploy, latency matrix (ADR-0003)

**Files:**
- Create: `services/gateway/scripts/smoke-meta.ts`.
  - **Input:** `evals/datasets/day1/*.jpg`, which are the team's photos, kept in git only if they contain no faces or personal data. Otherwise they go in `evals/datasets/private/`.
  - **Per image:** `parseScreen` → for the first `button` element, `segmentByBox` → `segmentByText('touchscreen display')`.
  - **Writes** `docs/evals/day1-smoke.md`:
    - a table per image: elements found, screenType, Spark latency, SAM latencies, input/output tokens;
    - p50/p95 for each call;
    - cost per parse, at $1.25/M input, $4.25/M output and $0.0025 per SAM image;
    - an SVG overlay per image (`docs/evals/day1/<name>.svg`) with polygons drawn on a downscaled base64 thumbnail, only for images under `day1/`.
- Create: `services/gateway/src/debug/latency.ts`.
  - Route `POST /v1/debug/latency`, only when `DEBUG_TOKEN` is set and the `x-debug-token` header matches.
  - Runs one `parseScreen` and one `segmentByBox` on a bundled 1024 px sample, and returns `{sparkMs, samMs}`.
- Create: `infra/deploy-gateway.sh <project> <region>`:
  - `gcloud builds submit --tag <region>-docker.pkg.dev/<project>/fp/gateway:<sha> --file services/gateway/Dockerfile .`
  - `gcloud run deploy fingerpost-gateway --image … --region <region> --timeout 3600 --concurrency 40 --min-instances 0 --set-secrets META_API_KEY=meta-api-key:latest --set-env-vars MODEL_MODE=live,GIT_SHA=<sha>,DEBUG_TOKEN=<random>`
- Create: `services/gateway/scripts/latency-matrix.ts <urlA> <urlB> --n 20`.
  - Measures `GET /healthz` RTT and `POST /v1/debug/latency` from the laptop (India).
  - Prints p50/p95 of `rtt + sparkMs` and `rtt + samMs` per region.
- Modify: `docs/adr/0003-cloud-run-region.md`. Fill in the Result table and the choice.

**Interfaces:**
- **Consumes:** `parseScreen`, `segmentByBox` and `segmentByText` (Task 4), and `buildApp` (Task 3).

- [ ] **Step 1: Run the smoke locally against live Meta.** `set -a; source .env; set +a; pnpm --filter @fingerpost/gateway exec tsx scripts/smoke-meta.ts`. Expected: `docs/evals/day1-smoke.md` exists, with ≥10 images and at least one target polygon per image.
- [ ] **Step 2: Inspect.** Open the SVG overlays. Check that polygons sit on the real buttons in 8 or more of 10 images, and note the failures in the report.
- [ ] **Step 3: Create the secret.** `printf %s "$META_API_KEY" | gcloud secrets create meta-api-key --data-file=- --project fingerpost-dev`
- [ ] **Step 4: Deploy to both regions.** `infra/deploy-gateway.sh fingerpost-dev asia-south1 && infra/deploy-gateway.sh fingerpost-dev us-central1`. Expected: both `/healthz` return ok.
- [ ] **Step 5: Run the matrix.** `pnpm --filter @fingerpost/gateway exec tsx scripts/latency-matrix.ts <urlAsia> <urlUs> --n 20`. Expected: a printed table.
- [ ] **Step 6: Record the result** in ADR-0003. Delete the losing region's service: `gcloud run services delete fingerpost-gateway --region <loser>`.
- [ ] **Step 7: Commit.**
  `git add -A && git commit -m "feat: live Meta smoke, Cloud Run deploy script, region latency matrix (ADR-0003)"`

### Task 6: `apps/web` kiosk simulator v0 (fast-food + PIN pad), touch logging

**Files:**
- Create: `apps/web/package.json` (vite, vitest, jsdom), `apps/web/index.html` (landing placeholder), `apps/web/sim/index.html`
- Create: `apps/web/src/sim/model.ts`. Types:
  - `SimElement {id, label, role: ElementRole, rect:{x,y,w,h} /*CSS px*/}`
  - `SimScreen {id, title, elements: SimElement[], next?: Record<elementId, screenId>}`
  - `SimScene {id, screens: SimScreen[], start: screenId}`
- Create: `apps/web/src/sim/rng.ts`. `mulberry32(seed: number): () => number`.
- Create: `apps/web/src/sim/scenes/fastfood.ts`. `buildFastFood(seed): SimScene`, with 4 screens:
  1. `home` (Start order);
  2. `menu` (Burgers, Drinks, Sides, Cart);
  3. `drink-size` (Small, Medium, Large, Back);
  4. `pay` (Total ₹149, Pay by card [role pay], Cancel).
  Button positions are jittered by ±4% from the seed.
- Create: `apps/web/src/sim/scenes/pinpad.ts`. `buildPinPad(seed, layout: 'phone'|'calculator'|'scrambled'): SimScene` with one screen: keys 0–9 [role key], Clear, OK [role confirm].
- Create: `apps/web/src/sim/hit.ts`. `hitTest(elements, x, y): SimElement|null`.
- Create: `apps/web/src/sim/log.ts`:
  - `recordTouch(state: RunState, t: {x,y,pointerId,ts}): TouchEvent`;
  - `exportRun(state): string` (JSON);
  - `labelsFor(screen, viewport:{w,h}): Array<{id,label,role,u,v,w,h}>`.
- Create: `apps/web/src/sim/main.ts`.
  - Renders the scene from the URL params `?scene=fastfood|pinpad&seed=1&layout=scrambled&run=<id>`.
  - Large high-contrast buttons; requests fullscreen on the first tap.
  - `touch-action: none` and no zoom.
  - A hidden 3-finger long-press opens the export panel (run JSON plus labels JSON, copyable).
- Test: `apps/web/test/sim.test.ts`

**Interfaces:**
- **Produces:**
  - Sim URL contract `?scene&seed&layout&run`.
  - `TouchEvent {runId, screenId, x, y, u, v, elementId: string|null, pointerId, ts}`.
  - `labelsFor` output: the eval ground-truth format, which Day 2 evals consume.
  - Day 2 adds `POST /v1/sim/events` on the gateway. Day 1 keeps logs in memory, plus export.

- [ ] **Step 1: Write the failing tests.**

```ts
test('mulberry32 is deterministic', () => { const a = mulberry32(7), b = mulberry32(7); expect([a(), a()]).toEqual([b(), b()]); });
test('scrambled pin pad is a permutation of 0–9 and differs from phone layout for seed 1', () => {});
test('same seed → identical fast-food layout; different seed → different', () => {});
test('hitTest on a gap between buttons returns null', () => {});
test('rapid double tap logs two events; second pointer of a multi-touch is logged too', () => {});
test('labelsFor returns u,v,w,h within [0,1] for every element', () => {});
test('pay screen has exactly one role=pay element', () => {});
```

- [ ] **Step 2: Run them and confirm they fail.** `pnpm --filter web test`. Expected: FAIL.
- [ ] **Step 3: Implement** the model, rng, scenes, hit and log as pure modules; then `main.ts` (DOM).
- [ ] **Step 4: Run the tests and confirm they pass.** `pnpm --filter web test`. Expected: PASS.
- [ ] **Step 5: Check by hand on the tablet.**
  - Run `pnpm --filter web dev --host`, then open `http://<laptop-ip>:5173/sim/?scene=fastfood&seed=1` on the Android tablet.
  - Walk home → menu → drink-size → pay. Export the run JSON and confirm there's one event per tap, with element ids.
- [ ] **Step 6: Commit.**
  `git add apps/web && git commit -m "feat(web): kiosk simulator v0 (fast-food, PIN pad), touch log + labels export"`

### Task 7: `apps/android` shell: Compose, CameraX, fingertip overlay, tone prototype, `core:guidance` math

**Prerequisite:** Task 0's Android tooling.

**Files:**
- Create: `apps/android/settings.gradle.kts` (modules `:app` and `:core:guidance`), `apps/android/build.gradle.kts`, `apps/android/gradle/libs.versions.toml` (versions from Tech Stack)
- Create the Gradle wrapper: `gradle wrapper --gradle-version 9.8.2`, run in `apps/android`.
- Create: `apps/android/core/guidance/build.gradle.kts`. A pure Kotlin JVM module with the JUnit 6 platform.
- Create: `apps/android/core/guidance/src/main/kotlin/io/github/fingerpost/guidance/OneEuroFilter.kt`
- Create: `apps/android/core/guidance/src/main/kotlin/io/github/fingerpost/guidance/Cues.kt`
- Test: `apps/android/core/guidance/src/test/kotlin/io/github/fingerpost/guidance/CuesTest.kt` and `OneEuroFilterTest.kt`
- Create: `apps/android/app/build.gradle.kts` (namespace and applicationId `io.github.fingerpost`, minSdk 29, target 36)
- Create: `apps/android/app/src/main/AndroidManifest.xml`. CAMERA permission; `screenOrientation` unspecified.
- Create: `app/src/main/kotlin/io/github/fingerpost/MainActivity.kt`
- Create: `app/src/main/kotlin/io/github/fingerpost/camera/CameraPipeline.kt`
- Create: `app/src/main/kotlin/io/github/fingerpost/vision/HandTracker.kt`
- Create: `app/src/main/kotlin/io/github/fingerpost/audio/ToneSynth.kt`
- Create: `app/src/main/kotlin/io/github/fingerpost/ui/SessionScreen.kt`
- Asset: `app/src/main/assets/hand_landmarker.task`, downloaded from `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`. Record its SHA-256 in `apps/android/ASSETS.md`.

**Interfaces:**
- **Produces (core:guidance, used from Day 2):**
  - `class OneEuroFilter(minCutoff: Double = 1.0, beta: Double = 0.007, dCutoff: Double = 1.0) { fun filter(x: Double, tSeconds: Double): Double }`
  - `fun toneFrequencyHz(errorMag: Double): Double`, which is `220 · 2^(3·(1 − min(e/0.5, 1)))` (guidance-spec §7)
  - `fun tonePan(ex: Double): Double`, which is `clamp(ex/0.3, −1, 1)`
  - `fun magnitudeWord(errorMag: Double): MagnitudeWord?`, with enum `A_LOT, NONE, A_LITTLE` and `null` below 0.03 (spec §5)
- **Produces (app):**
  - `HandTracker.results: StateFlow<FingerSample?>`, where `FingerSample(tipX: Float, tipY: Float, dipX: Float, dipY: Float, presence: Float, frameTsMs: Long, inferenceMs: Long)` in **image px** of the analysis frame.
  - `ToneSynth.start()`, `stop()`, `setFrequency(hz: Double)`, `setPan(pan: Double)`.

- [ ] **Step 1: Write the failing JVM tests.**

```kotlin
class CuesTest {
  @Test fun toneAtFarIs220() = assertEquals(220.0, toneFrequencyHz(0.5), 1e-9)
  @Test fun toneAtZeroIs1760() = assertEquals(1760.0, toneFrequencyHz(0.0), 1e-9)
  @Test fun toneClampsBeyondFar() = assertEquals(220.0, toneFrequencyHz(2.0), 1e-9)
  @Test fun panClamps() { assertEquals(1.0, tonePan(0.9), 1e-9); assertEquals(-0.5, tonePan(-0.15), 1e-9) }
  @Test fun magnitudeBuckets() {
    assertEquals(MagnitudeWord.A_LOT, magnitudeWord(0.31)); assertEquals(MagnitudeWord.NONE, magnitudeWord(0.2))
    assertEquals(MagnitudeWord.A_LITTLE, magnitudeWord(0.05)); assertNull(magnitudeWord(0.02))
  }
}
class OneEuroFilterTest {
  @Test fun constantSignalIsUnchanged() { val f = OneEuroFilter(); repeat(30) { assertEquals(0.4, f.filter(0.4, it / 30.0), 1e-9) } }
  @Test fun reducesJitter() { /* alternating 0.4±0.01 at 30 Hz → output variance < 25% of input variance after 15 samples */ }
}
```

- [ ] **Step 2: Run them and confirm they fail.** `cd apps/android && ./gradlew :core:guidance:test`. Expected: FAIL (unresolved references).
- [ ] **Step 3: Implement** `Cues.kt` and `OneEuroFilter.kt`, following the standard One Euro algorithm (Casiez 2012).
- [ ] **Step 4: Run the tests and confirm they pass.** `./gradlew :core:guidance:test`. Expected: PASS.
- [ ] **Step 5: Implement the app shell.**
  - `CameraPipeline`: Preview + ImageAnalysis at 1280×720, `STRATEGY_KEEP_ONLY_LATEST`, RGBA_8888 output.
  - `HandTracker`: MediaPipe `HandLandmarker` in `RunningMode.LIVE_STREAM`, `Delegate.GPU`, `numHands 2`, fed a 640×480 downscale. Emits landmarks 8 and 7 scaled back to analysis px.
  - `ToneSynth`: `AudioTrack` with `PERFORMANCE_MODE_LOW_LATENCY`, 48 kHz stereo float; a sine generator on its own thread with 5 ms parameter ramps.
  - `SessionScreen`: the full-screen preview with an overlay dot on the tip and an fps/inference-ms label.
    - The whole screen is one TalkBack element: contentDescription "Fingerpost camera. Double-tap to start or stop the tone."
    - The tone frequency maps from the tip x position: `toneFrequencyHz(1 − tipX/width)`, for the prototype only.
  - **Camera permission denied:** the screen says so via `announceForAccessibility`, plus a button to open app settings.
- [ ] **Step 6: Install and check on the device.**
  - `./gradlew :app:installDebug`, on the Android phone with USB debugging on.
  - Expected: the dot follows the index fingertip, and the label shows ≥25 fps with inference ≤25 ms.
  - The tone changes pitch as the finger moves left and right; with TalkBack on, double-tap toggles the tone.
  - Record fps and inference ms in `docs/evals/day1-device.md`.
- [ ] **Step 7: Commit.**
  `git add apps/android && git commit -m "feat(android): Compose shell, CameraX, MediaPipe fingertip overlay, tone prototype, guidance cue math"`

### Task 8: CI + lane-C docs (tester protocol, consent, outreach)

**Files:**
- Create: `.github/workflows/ci.yml`. Three jobs:
  - `ts`: pnpm/action-setup, setup-node 24, `pnpm install --frozen-lockfile`, `pnpm -r typecheck`, `pnpm -r test`.
  - `android`: setup-java temurin 21, gradle/actions/setup-gradle, `./gradlew :core:guidance:test :app:assembleDebug`, run in `apps/android`.
  - `web`: `pnpm --filter web build`.
- Create: `.github/dependabot.yml` (npm, gradle, github-actions; weekly).
- Create: `docs/tester-protocol.md`. The 45-minute session:
  - onboarding, 5 min;
  - 3 single-target tasks on the appliance and sim, 15 min;
  - 1 multi-step sim task, 10 min (from Day 4);
  - PIN-pad exploration on the sim, 5 min;
  - interview, 10 min.
  - The metrics captured automatically come from sim runs.
  - Proxies must be labeled as proxies.
- Create: `docs/consent-form.md`. Plain language in EN and HI, screen-reader friendly (headings, no tables):
  - voluntary;
  - stop anytime;
  - no real payments;
  - no face recording without a separate yes;
  - quotes credited only if wanted.
- Create: `docs/outreach.md`. Message templates in EN and HI: short DM, email, and a Reddit post (r/Blind). The target list is the one from design §7 Day 1, C.
- Create: `docs/testers.md`. Outreach log: org, channel, date sent, status. No personal data.

- [ ] **Step 1: Write the files.**
- [ ] **Step 2: Push and watch CI.** `git push && gh run watch`. Expected: all three jobs green.
- [ ] **Step 3: Commit** (before pushing).
  `git add .github docs && git commit -m "ci: ts/android/web pipelines; docs: tester protocol, consent, outreach"`

---

## Day 1 exit check (23:00 IST)
1. Task 7 Step 6: fingertip at ≥25 fps on the Android phone.
2. Task 5 Step 2: a valid layout and target polygon for real panel photos.
3. Task 5 Step 6: ADR-0003 filled in.
4. Task 6 Step 5: sim runs on the tablet.
5. Task 8 Step 2: CI green.

Misses go into tomorrow's 10:00 stand-up for cut decisions (design §1, cut order).
