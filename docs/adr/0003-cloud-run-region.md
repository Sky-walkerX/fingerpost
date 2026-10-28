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
The Day 1 debug endpoint times a Spark parse followed by a fixed-box SAM prompt. The local matrix reports health RTT, each gateway phase and the actual debug-request round trip after checking HTTP status and numerical response validity. The private sample must be a 1024×576 JPEG within the 409,600-byte keyframe limit.

These are diagnostic inputs, not the complete keyframe → target measurement. Voice Transcribe connection timing and the required total-flow evidence are still missing. Do not select a region from RTT+Spark alone or by adding independent percentile values. This ADR remains proposed until all 20-sample measurements above are recorded; no region has been chosen.
