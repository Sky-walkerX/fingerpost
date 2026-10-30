# Day 2 coding verification — 2026-10-28

The user explicitly resumed Day 2 coding while Day 1 remains incomplete. D2-T4, T5 and T6 are complete within their standalone logic scope. The original implementation/validation below is dated 2026-10-28. **Update 2026-10-30:** T7's live Step 4 now passes; regional redeployment remains blocked. See [current checks, startup fix and live results](through-day2-t7-2026-10-30.md).

## Implemented and verified

- **T4:** pure JVM state transitions, retries, no-hand prompting, target hysteresis, press/verification handling and cancellation. The user resolved the DONE conflict in favor of guidance-spec §8. The plan and supplied happy-path test/asset now wait for actual speech completion. Completion ids survive the speech queue; stale or unrelated callbacks cannot finish a later task. Android TTS callback wiring remains T10c.
- **T5:** normalized exact/localized/alias matching, token-set fallback, ambiguity detection, position descriptions and bounded label lists. Seven supplied tests and ten added boundary cases pass.
- **T6:** goal/locale state, task gate/usage hooks, fingerprints/Jaccard, locate/clarify/SAM targets and press verification. Nine supplied cases and eleven added regressions pass, including null SAM confidence, stale touch state and protocol limits. The temporary SHA fingerprint remains the documented Day 2 algorithm, not kiosk-memory SimHash.
- **T7 coding:** Voice Transcribe handshake/audio relay, session controller and simulator event registry/route. Pre-open audio is limited to 160,000 bytes; audio after end is ignored. One final/error completes each utterance; trailing audio is ignored until its `audio.end` boundary, preventing duplicate requests/retries; cancellation/disposal suppress stale callbacks. Provider errors become one fixed spoken retry. Ledger hooks handle rejection without unhandled promises. Simulator token comparison is timing-safe and live mode omits the route without a configured token. Abort returns the existing `finish{aborted}` message.

The relay follows [Meta's Voice schemas](https://dev.meta.ai/docs/api-reference/voice/schemas): lifecycle/unknown event types are ignored, and only `speechComplete` finishes an endpointing turn. No audio, transcript, key, image or provider error is logged or committed. Tests use synthetic fixtures and local fake providers.

Existing Day 1 regional/debug routes, overrides, scripts and token redaction are retained. Only the plan's pinned `ws` 8.22.0 dependency was added; no existing lockfile dependency version changed. No public protocol schema/fixture changed. Finished quota/error/utility assets and all four supplied gateway test files are unchanged. The registry's finished unsubscribe closure needed an idempotency correction so an old callback cannot remove a new run subscription.

## Validation

Failing-first checks confirmed 7 supplied +10 boundary T5 TODO failures; 15 supplied +11 boundary T4 TODO failures (one queue metadata test already passed); 9 supplied +10 boundary T6 TODO failures and a separate null-confidence regression; 9 supplied +13 boundary T7 failures and additional lifecycle/abort regressions. A final review added two failing trailing-audio assertions (error and endpoint completion); the controller now waits for the microphone end boundary before opening a new relay. No test was disabled or weakened. The sole changed supplied expectation is the user-authorized DONE speech-completion correction.

- `pnpm -r test`: **268 pass** — protocol 48, gateway 206, simulator 14.
- `pnpm -r typecheck` and `pnpm -r build`: pass.
- `./scripts/android.sh :core:guidance:test --console=plain`: **112 pass, zero failures/errors/skips**.
- `./scripts/android.sh :core:protocol:test :app:test :app:assembleDebug --console=plain`: succeeds; protocol has 49 passing cases in its current report and app unit tests have no source cases. Android compatibility was checked after T4; subsequent gateway work changes no Android files.
- A delayed-model WebSocket test verifies that an arriving verify cannot overtake locate. A separate mock voice→target→simulator press→verify test passes.
- Both Node 24 source and compiled gateways complete that mock flow through real localhost HTTP/WebSocket connections. External model calls: **zero**. Local socket tests require permission to listen on loopback.
- `git diff --check` passes. [CI at implementation c1be57e](https://github.com/Sky-walkerX/fingerpost/actions/runs/40664266695) passes both ts/android jobs, including frozen install, all TS/tooling/JVM tests and the Android debug build. Later documentation-only changes are not part of that run.

## Remaining gate (updated 2026-10-30)

Private Meta credentials now work. The live gateway Step 4 passed with actual Spark/SAM/Voice Transcribe, synthetic speech/image input, authenticated session traffic and protected simulator press/verification. The local check used memory stores and an ephemeral issued JWT; it does not verify Firebase login, hardware attestation, Firestore or the deployed service.

ADR-0003 remains proposed; there is no approved region to redeploy to. The user confirmed photos and cloud setup are not ready. T7 Step 5 stays unchecked and T7 stays blocked until D1-T5 regional evidence/decision and cloud prerequisites are complete. Blocked work gates its dependents under the current AGENTS.md rules.

Subsequent incoming commits contain Android guidance-engine, session/microphone, PIN and auth integration. Their device acceptance remains open and assigned to teammates; see [integration handoff](android-integration-handoff.md). Their presence does not complete Day 1 performance or Day 2's phone/tablet closed loop.
