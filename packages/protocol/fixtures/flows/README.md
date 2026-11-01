# Shared flow contracts

These synthetic scripts freeze the intended client/server turns for Days 4–5. They use existing fp.v1 types; no wire schema changed. They are contracts for later replay tests, not evidence that the multi-step agent, device turns or simulator PIN transition are implemented.

- `medium-cola`: task guidance, matching amount confirmation, payment target, verification and local PIN entry.
- `guide-start`: single-target guidance and successful verification.
- `explore-summary`: exploration keyframe, short summary, more detail and abort.
- `go-back`: external Back press, fresh menu keyframe and re-planned drinks target.
- `memory-hit` (Day 5, B5-0): a second visit to the home screen. The locate keyframe carries OCR tokens, the gateway answers from kiosk memory (`layout.source: "memory"`) and targets Start order; no schema change (`Layout.source` already allows `memory`).

Layouts/coordinates come from the seed-1 synthetic fast-food scene. The future `pin` marker is permitted by the Day 4 contract; adding that simulator state remains C4-1. In the payment script the last verification image is still the safe pay panel, before PIN appearance. The next event records local PIN entry; there are no PIN-image or later audio uploads. This script does not model sensor timing or prove the on-device PIN gate.

`id: "*"` is a replay wildcard for generated message ids. Correlation ids on keyframes, confirms and replies are explicit. All timestamps are the deterministic test value zero. Wildcards are a fixture convention, never a protocol/schema extension. Kotlin and TypeScript tests validate every message; actual runtime replay belongs to A4-1, B4-2 and C4-2.
