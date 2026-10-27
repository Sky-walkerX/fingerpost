# ADR 0002: Real-time "body" on the device, agent "brain" on the gateway
- Status: accepted (2026-10-27)

## Context
Finger guidance has to react within 100 ms at 30 fps. SAM 3.1 and Spark on the Meta Model API are request/response calls that take hundreds of milliseconds to seconds. Sideloaded APKs don't auto-update. API keys must never ship inside the app.

## Decision
- **Device:** owns perception and guidance (hand tracking, screen homography, cue planning, audio and haptics) and every safety-critical local mode (PIN mode, the confirm gate check, offline basic).
- **Gateway:** owns the agent loop, the prompts, model routing, quotas, kiosk memory and the API keys.
- **Link:** the two talk over one WebSocket session (`fp.v1`).

## Consequences
- Prompts and policy can be fixed without shipping an APK. Future iOS and glasses clients reuse the brain.
- The guidance loop never waits on the network, and PIN safety works offline.
- One Cloud Run WebSocket per active session. The session state is small and can be rebuilt from a client digest.
