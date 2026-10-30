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

## Remaining work

- D1-T5 Steps 1/2 remain incomplete. Investigate the Spark deadline on real-panel inputs, then rerun all ten and inspect the private overlays before recording the ≥8/10 quality gate. Do not change the prompt or weaken acceptance to hide the failure.
- The approved 1,024×576 regional crop, cloud setup, two matching-revision deployments, 20 samples per region and ADR-0003 remain pending.
- No application/source code changed in this preparation. Dataset checks and live attempts were run; unrelated unit/build suites were not rerun for a download/documentation-only change.
