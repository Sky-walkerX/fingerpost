# Threat model

Scope: the source at the November 2 local completion checkpoint. Tests below are synthetic evidence; they do not establish production configuration or device acceptance. PIN protection on a compromised client cannot be guaranteed by the gateway.

| Surface / threat | Mitigation in source | Evidence / outstanding check |
|---|---|---|
| Auth: spoofing and privilege escalation | Attestation chain, app/signing digest, challenge, Firebase identity and expiring session JWT | `attestation.test.ts`, `auth-routes.test.ts`, `token-boundaries.test.ts`, `session-expiry.test.ts`; human root review and real Firebase/hardware acceptance pending |
| Auth: replay and denial of service | Single-use bounded challenges, IP limiter; deployment constrained to match in-memory state | `auth-routes.test.ts`, `quota.test.ts`; verify actual deployment instance/concurrency settings |
| Session: tampering | fp.v1 validation, bounded frame sizes, protected simulator route, server and device payment policies | `session.test.ts`, `sim-cors.test.ts`, `policy.test.ts`; physical wrong-payment gate remains open |
| Session: information disclosure | Local PIN gate, private routing, content-free errors and redacted credentials | `cancellation.test.ts`, `router.test.ts`, `full-frame.test.ts`; numeric on-device no-upload audit required |
| Session: denial of service | Per-task budgets, quotas, bounded ASR buffers, timeout/breaker, fail-closed accounting | `accounting-failure.test.ts`, `quota.test.ts`, `breaker.test.ts`, `load.test.ts`; deployed load and spend-cap inspection pending |
| Memory: poisoning and disclosure | Independent attested writers, bounded salted key hashes, fresh OCR agreement, sensitive-token filtering | `memory.test.ts`; inspect production collection rules and stored records before enabling |
| Donations: consent bypass and disclosure | Explicit opt-in, bounded signed uploads, redaction requirements and 90-day lifecycle configuration | `donate.test.ts`; bucket IAM, actual blur quality and lifecycle deletion need live acceptance |
| Waitlist: spam and personal-data disclosure | Email/locale schema, honeypot, IP limits, server-side store and normalized deduplication | `waitlist-config.test.ts`; production IAM, persistence and deletion handling remain operational gates |
| Operations: repudiation and disclosure | Revision IDs and numeric error/latency/spend measurements, no request bodies or recognized content | Inspect production logging/redaction/retention and operator access; never attach raw content to incidents |

Before release, verify the deployed revision has auth required, software attestation disabled, correct release digests, restricted debug/simulator routes and working revocation refresh. Run dependency auditing and review high-severity findings without silently changing pinned versions. The [runbook](runbook.md) describes response procedures; production alerts still require setup and a test notification.


Day 6 source additions: the budget-stop job has no public HTTP surface. Its dedicated service account consumes only the approved subscription via ADC; topic publishing must be restricted to the configured Cloud Billing publisher. Budget/account/schema/currency/calendar checks reject unrelated or stale notifications; only disablement is written, before acknowledgement. Persistence failure leaves a delivery for retry. Native SDK/process deadlines and bounded Pub/Sub bodies/batches limit stalled or oversized input. Regression coverage: budget-job.test.ts and budget-pubsub.test.ts. Production IAM, publisher restrictions and current billing period require operator review.

Offline ASR uses only the platform on-device service; unavailable/old platforms fail safely. Offline TTS selects only non-network voices. Cancellation generations reject late transcripts. Coverage: OfflineAsrTest and TtsSpeakerTest; actual device/network behavior remains a required acceptance check.
