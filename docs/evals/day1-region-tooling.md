# Day 1 regional measurement tooling — 2026-10-28

**Coding complete; live evidence pending. D1-T5 remains blocked.** No Meta request, cloud deployment, live quality result or region choice is claimed.

## Implemented

- `POST /v1/debug/asr-connect` times a fresh gateway-to-Meta WebSocket upgrade and, separately, acceptance of the authenticated Voice Transcribe handshake. It sends the planned Standard model/ENDPOINTING/PCM_16KHZ configuration, requires the documented `sessionId` acknowledgement, then sends `endStream` and closes. No audio is sent and no session id, transcript or provider error is returned or retained.
- `/v1/debug/region-target` is a private developer WebSocket benchmark, enabled only with `DEBUG_TOKEN`. The first text frame authenticates with that token; the remaining frames use the existing `hello`, `goal` and binary `keyframe` contracts. A private envelope wraps the unchanged server message and numerical phase timings. Application schemas/fixtures and Kotlin models are unchanged.
- A rectified 1024×576 JPEG within the existing 409,600-byte limit is parsed by Spark. Exactly one normalized label must match the private goal; missing/ambiguous matches fail. Sensitive layouts and protected controls fail. SAM receives the selected control's actual pixel box. Its polygon, or the element polygon when SAM returns no mask, becomes a schema-validated `target`. Mask fallback count is reported separately.
- The client starts its monotonic timer immediately before sending the binary keyframe and stops after receiving and validating that target. This includes upload, frame validation, parsing, exact-label selection, SAM refinement, serialization, download and client validation. It excludes JPEG/frame preparation, WebSocket/auth/goal setup, speech transcription and Android guidance. It is a controlled exact-label benchmark, not the unimplemented general Day 2 task pipeline.
- The matrix collects health RTT, ASR upgrade/accepted-handshake time, Spark/SAM phases and directly observed binary-keyframe-to-target p50/p95. It never sums phase percentiles. Both regions must finish before anything is printed. Ranking requires 20 live samples per candidate; mock/short runs are labeled diagnostic, and equal totals yield a tie. It leaves ADR-0003 proposed pending recorded live evidence, matching deployment revisions and quality review.

The ASR acknowledgement and authentication fields were checked against [Meta's Voice schemas](https://dev.meta.ai/docs/api-reference/voice/schemas).

## Boundaries

No dependency or pinned version changed: the probe/client use Node 24's native WebSocket and the gateway's existing plugin. The benchmark is single-use (four request frames) and time-bounded to 60 seconds per connection/request, an initial diagnostic value matching the existing HTTP tool. Authentication precedes image/model processing. Token comparison is timing-safe; debug headers are redacted. Unexpected SDK/socket/HTTP/schema failures become fixed errors, never successful timing samples or raw provider output. Socket listeners/timers are cleaned up on completion/failure.

The strict JPEG check reads dimension headers; it does not fully decode or visually approve a photo. Use an approved nonsensitive appliance crop. This developer benchmark does not implement or prove the later Android PIN gate, user confirmation policy, microphone relay or natural-language goal resolver. Preserve its route registration, override and redaction when merging later app assets.

## Validation

Failing-first runs confirmed eight ASR TODO failures, ten route TODO failures, thirteen client/matrix TODO failures, eleven CLI TODO failures and the missing request-frame bound. The test harness was corrected to await Fastify readiness; no test expectation, timeout or safety threshold was weakened.

All **143 gateway tests**, **48 protocol tests** and **14 simulator tests** pass: **205 TypeScript tests** total. Recursive typecheck and all workspace production builds pass. The **49 new gateway cases** include actual localhost native-WebSocket exchanges with synthetic bytes and fake providers; no external model call is made. Existing tests remain intact. Android code and dependencies are unchanged in this work.

[CI at implementation cd3aed5](https://github.com/Sky-walkerX/fingerpost/actions/runs/40658914167) passes both `ts` and `android`, retaining all original checks.

The compiled gateway also completes two localhost mock benchmark samples through real binary target exchanges. Mock ASR timings are zero placeholders and never qualify for live ranking. No mock timing figure is recorded as live performance.

## Run after human prerequisites are ready

1. Supply the approved JPEG at ignored `evals/datasets/private/day1/latency-sample.jpg`.
2. Configure `DEBUG_TOKEN` and `LATENCY_GOAL` privately in the ignored root `.env`; the goal is an exact label visible in that crop. Never put the label/token in a URL or public report. Gateways need the Meta key in their configured secret, not on this client.
3. Deploy the same committed revision to both candidate regions using the existing D1-T5 steps. These commands make live model requests and require the human account/billing setup.
4. From the repository root:

```bash
set -a
source .env
set +a
pnpm --filter @fingerpost/gateway latency:region <asiaUrl> <usUrl> --n 20
```

Record the numerical comparison, candidate/revision mapping, conditions and manual quality result in ADR-0003 before accepting it. Retain the same crop and exact goal across candidates. The original `latency` command remains available for its fixed-box HTTP diagnostic; its figures alone are insufficient for the region decision.
