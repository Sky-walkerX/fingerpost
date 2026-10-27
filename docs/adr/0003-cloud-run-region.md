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
