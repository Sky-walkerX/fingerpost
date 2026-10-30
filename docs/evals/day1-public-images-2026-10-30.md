# Day 1 public-photo preparation — 2026-10-30

Owner: Codex. The user explicitly requested downloading the ten appliance photos from the internet. This replaces the missing local smoke inputs with an internet-sourced evaluation set; it does not establish app-camera or field-test quality.

## Dataset prepared

- Ten distinct JPEG photographs downloaded from Wikimedia Commons into ignored `evals/datasets/day1/`.
- Coverage: two washing-machine panels, one microwave panel, three induction cooktops and four air-conditioning controllers.
- All ten were visually inspected: actual appliance controls, no visible people, PIN/payment screens or personal information. The set includes symbols and several languages, perspective, glare, small controls and partial panel framing; it is not a balanced or representative field dataset.
- All ten decode as JPEGs with Pillow, pass the gateway's existing JPEG-header preflight, and have distinct SHA-256 hashes. Width is 1,280 pixels; minimum height is 720 pixels. Total size is 2,140,026 bytes.
- No local pixel edits. Wikimedia preview renditions were downloaded. One image exceeds the app's 409,600-byte keyframe limit; these smoke inputs go through the existing gateway model-adapter evaluation, not the fp.v1 upload path. They are not prepared regional benchmark crops.
- Source page, original/download URLs, author, license/link, rendition note, dimensions and hash are recorded for every image in local `evals/datasets/day1/sources.json`. A local README also contains attribution. Six images use CC BY-SA 4.0; one each uses CC BY-SA 3.0, CC BY-SA 2.0, CC BY 4.0 and CC BY 3.0.
- `git check-ignore` confirms the photos, manifest and local README are ignored. No real image bytes, recognized labels, author/device details, provider responses or credentials enter this commit.

The user-authorized public corpus is suitable for an initial model smoke attempt. It does not complete D1-T0's remaining setup, regional crop, device checks or any quality threshold by its presence alone.

## Live smoke attempt and blocker

The existing ten-photo runner was attempted twice with the existing Standard adapters and unchanged client policy. Both full runs failed before writing the first overlay or a completed numerical report. No ten-image correctness score or success percentile is available.

First command (loads private credentials without shell expansion or printing them):

```sh
node --conditions=source --input-type=module -e 'import {readFileSync} from "node:fs"; import {parseEnv} from "node:util"; import {main} from "./services/gateway/scripts/smoke-meta.ts"; process.exitCode=await main(parseEnv(readFileSync(".env","utf8")));'
```

First output (all available; exit 1):

```text
Live smoke failed. Check the private dataset, credentials and model availability locally.
```

An isolated diagnostic then successfully ran the first image through all three adapters: Spark 28,047 ms with 22 elements; SAM box 6,650 ms with a polygon; SAM text 2,195 ms with no matching display polygon. An absent concept is a normal empty SAM result. This diagnostic is not a ten-image evaluation and does not explain the earlier failure by itself.

Second command: `node --conditions=source /tmp/fingerpost-public-smoke.mts`. This temporary harness called the unchanged `runSmoke` with the same dataset, adding only numerical stage/error classification; no prompt, model, timeout, retry policy or dependency changed. It never printed exception text. Last output (all available; exit 1):

```json
{"smokeCompleted":false,"sample":1,"stage":"spark","errorKind":"APIConnectionTimeoutError"}
```

`createMetaClient` currently sets a 15,000 ms request timeout and one SDK retry. The successful isolated Spark duration includes SDK/transport work; no internal provider/compute breakdown was measured. The second full attempt confirms a request deadline failure, not a rejected key or invalid JPEG. The cause of the first generic failure is unconfirmed. After the two failed full attempts, retries stopped under AGENTS.md §9.

## User-requested API timeout investigation

The user explicitly resumed investigation of the Meta/Spark timeout. Two controlled diagnostics used the same first JPEG, locale, system/user prompt, strict JSON schema and Standard Spark 1.3 model. Each had a temporary 60,000 ms diagnostic deadline and **zero retries**; production settings were not changed. Model-list requests returned HTTP 200 and confirmed Spark availability.

| Diagnostic | Spark HTTP | Fetches | Headers ms | Complete parse ms | Input tokens | Output tokens | Reasoning tokens | Elements |
|---|---|---|---|---|---|---|---|---|
| Existing request; reasoning omitted/model-set | 200 | 1 | 22,198 | 22,211 | 2,413 | 4,850 | 3,033 | 27 |
| Same request with explicit `reasoning_effort: low` | 200 | 1 | 10,676 | 10,696 | 2,413 | 2,691 | 1,229 | 22 |

Commands: `node --conditions=source /tmp/fingerpost-spark-timeout-check.mts` and the same command with `low`. The temporary harness loaded credentials with `parseEnv`, overrode only its own client deadline/retry policy, and printed numeric status/timing/usage fields. For the low-effort diagnostic it added that one request field. It retained no image response text, thinking content, labels, key or request/session ids.

**Confirmed:** the unchanged image request can succeed after 22.2 seconds, beyond the production client's 15-second deadline. Authentication, this JPEG and the strict response schema are accepted. This reproduces a mismatch between the configured deadline and a valid request's observed completion time. It does not identify how much time belongs to network, provider queueing, image processing or model reasoning, nor prove the cause of every earlier generic failure.

**Measured lead for improvement:** explicit low reasoning completed in 10.7 seconds on this image with fewer reasoning tokens. Meta documents that omitted effort is model-set and that effort controls reasoning depth; its exact default level is unspecified. See the [Chat Completions guide](https://dev.meta.ai/docs/protocols/chat-completions) and [reasoning/token guide](https://dev.meta.ai/docs/cookbook/reasoning-thinking-tokens). These are single, sequential requests; service load/cache effects are not isolated, and a different element count does not prove better or worse accuracy. Neither request establishes latency percentiles or the project's interactive SLOs.

No production timeout, retry setting, reasoning parameter, prompt, dependency or acceptance criterion changed. The API check is complete; the ten-image smoke/quality gate remains incomplete. Next: evaluate explicit reasoning effort over the full corpus and manually score correctness before adopting a production setting. Any longer offline evaluation budget must remain bounded and must not be reported as a fix for real-time latency.

## Full-corpus follow-up

The user authorized the next evaluation. The first explicit-low attempt completed five photos, then timed out at the sixth SAM box request under the temporary 60-second bound. This exposed a runner defect: a failed later call discarded the final report and could prevent a completed box overlay from being written. Five new synthetic regression tests were added failing-first; the runner now checkpoints anonymous metrics/overlays, records failed stages, continues independent samples and still rejects the run if any model call fails. Failed calls are explicitly excluded from success percentiles and may still incur billing.

The next diagnostic completed all ten photos and 30 calls with zero retries/errors. Manual browser review scores **6/10 correct targets**, below the unchanged ≥8/10 gate. Spark p50/p95 is **9,655/14,907 ms**. The complete profile, sample scores and numerical tables are in [the smoke report](day1-smoke.md). The candidate is rejected; production request settings and prompts remain unchanged. No default-policy ten-photo acceptance, closed-loop latency or regional deployment is claimed.

Both diagnostic commands were `node --conditions=source /tmp/fingerpost-evaluate-low.mts`. The temporary harness wraps the existing model port and runner, adds only explicit low reasoning plus the diagnostic deadline/retry bound, loads the private key with `parseEnv`, and prints numeric stages or a fixed error classification. The second invocation uses the corrected runner; no failed call is retried within either invocation. First invocation's final output (exit 1):

```json
{"sample":6,"stage":"spark","ms":12720,"elements":12,"inputTokens":2355,"outputTokens":2017}
{"complete":false,"sample":6,"stage":"sam-box","errorKind":"APIConnectionTimeoutError"}
```

Second invocation's final output (exit 0):

```json
{"sample":10,"stage":"spark","ms":7718,"elements":13,"inputTokens":2413,"outputTokens":1600}
{"sample":10,"stage":"sam-box","ms":2863,"polygonPresent":true}
{"sample":10,"stage":"sam-text","ms":2102,"polygonPresent":false}
{"complete":true,"samples":10,"requestTimeoutMs":60000,"maxRetries":0,"reasoningEffort":"low"}
```

No further identical full diagnostic is needed: the complete run supplies the quality rejection. No claim is made about the internal cause of the earlier SAM timeout.

Validation: **333 TS tests** pass (259 gateway, 48 protocol, 20 web, six evals), including all five new runner cases; recursive typecheck and gateway build pass. The full test command required loopback socket permission. Android/Python checks were not rerun locally for this TS evaluation-tool change. After pushing implementation ff3e5ff, [CI run 41061304203](https://github.com/Sky-walkerX/fingerpost/actions/runs/41061304203) passes both jobs, including frozen install, recursive TS checks, Python tooling, guidance/protocol/app tests and Android debug assembly. `gh run watch 41061304203 --interval 15 --exit-status` exits 0. This does not establish device acceptance or model accuracy beyond the reported manual review.

## Remaining work

- D1-T5 production-policy smoke/quality acceptance remains incomplete. The ten-photo low-reasoning diagnostic and inspection are finished, but 6/10 accuracy fails. Correct the localization issues through the documented evaluation workflow before adopting a request or prompt change; do not weaken the gate.
- The approved 1,024×576 regional crop, cloud setup, two matching-revision deployments, 20 samples per region and ADR-0003 remain pending.
- The original download/API investigation changed documentation only. This follow-up changes the smoke runner and adds five synthetic regressions; model requests and application behavior are unchanged.
