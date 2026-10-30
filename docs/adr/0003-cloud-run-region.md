# ADR 0003: Cloud Run region
- Status: proposed. Decided on Day 1 from measurements.

## Context
Users and testers are in India. The location of the Meta Model API servers isn't documented. The client→gateway leg and the gateway→Meta leg both add latency.

## Decision procedure
1. Deploy the smoke service to `asia-south1` and to `us-central1`.
2. From an Indian connection, measure p50 and p95 of client→gateway RTT, plus gateway→Meta latency for:
   - Spark 1.3 with one 1024 px image and a JSON schema;
   - SAM 3.1 with one box prompt;
   - the Voice Transcribe connect time.
   Use 20 samples each.
3. Pick the region with the lowest p50 total for "keyframe → target".

## Result
_(fill in: table + choice)_

## Measurement readiness
The original `latency` command remains a fixed-box HTTP diagnostic. The additional `latency:region` command now measures a controlled, exact-label binary-keyframe-to-target benchmark and gateway-to-Meta Voice Transcribe upgrade/accepted-handshake timing. Both regions must finish all requested samples before a comparison is printed. No phase percentile is added to another to invent a total.

The benchmark uses an approved nonsensitive 1024×576 rectified JPEG within 409,600 bytes and the same privately configured exact control label across candidates. It returns a validated target after Spark selection and SAM refinement, reporting mask fallbacks separately. It excludes JPEG preparation, socket/goal setup, transcription and Android guidance; it is separate from the implemented Day 2 session pipeline. See [tooling details and validation](../evals/day1-region-tooling.md).

The code and mock/local transport checks are complete. **Live evidence is not:** no candidate deployment, 20-sample live comparison, matching-revision check or manual quality result has been recorded. Mock/short diagnostics cannot select a region. Keep this ADR proposed until all required evidence is recorded; no region has been chosen.

On 2026-10-30 the existing measurement path passed one local live diagnostic with synthetic input, including the accepted ASR handshake and a SAM-refined binary target. This verifies provider integration only; it supplies no regional ranking or real-panel quality evidence. See [current test scope](../evals/through-day2-t7-2026-10-30.md).
