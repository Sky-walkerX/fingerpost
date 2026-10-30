# Deferred cloud revalidation

On 2026-10-30 the user confirmed that no GCP account is currently available and requested local testing/future development. Cloud-dependent tasks remain blocked; local/mock work may continue. This checklist records what to repeat when the user restores access. No item below is satisfied by a unit test, fixture, prior local model diagnostic or copied implementation.

## Human prerequisites

- [ ] GCP/Firebase projects and linked billing, required APIs and regional Artifact Registry repositories are ready.
- [ ] Firestore/Firebase Authentication are configured; the runtime/build identities have their required IAM access.
- [ ] Secret Manager has the required provider/debug/session/simulator secrets. Values remain private and out of chat/commits; service-account credentials are not committed.
- [ ] Android Firebase configuration and signing-certificate allowlist match the tested build.

## Repeat local checks at the revision to deploy

- [ ] Frozen dependency install, recursive TypeScript tests/typecheck/build, Python tooling tests.
- [ ] Kotlin guidance/protocol/app tests and debug assembly; required device checks remain independent.
- [ ] Verify no captures/credentials enter the upload context or Git changes.

## D1-T5 and ADR-0003

- [ ] Approved safe regional crop/exact goal and reviewed real-photo ground truth are ready.
- [ ] Deploy the same committed revision to both candidate regions, with current authentication and secret bindings; verify health and deployment revision.
- [ ] Run the real-photo smoke/quality checks with the current request policy; retain private overlays, publish only anonymous metrics and manual correctness results.
- [ ] Obtain 20 complete live samples per region: RTT, Spark/SAM phases, ASR upgrade/accepted handshake and directly observed keyframe-to-target totals/fallback counts.
- [ ] Select a region only from the required evidence and accept ADR-0003. The previous 6/10 experimental low-reasoning score is a failed diagnostic, not acceptance.

## D2-T7/T8 and Day 3 integration

- [ ] Repeat the authenticated deployed voice → goal → target → protected simulator press → verify flow with the real provider APIs.
- [ ] Verify Firebase token validation, hardware attestation/revocation, Firestore quota/spend persistence and kill-switch behavior under the deployed service account. Memory stores or an ephemeral local JWT do not establish these.
- [ ] Run the labeled live baseline and preserve its request policy, prompt/version and measurement scope. Do not substitute mock scores or predictions as truth labels.
- [ ] Complete the applicable phone/tablet, TalkBack, tracking-performance and proxy checks. A cloud account does not replace device acceptance.

## Future local work

- [ ] Recheck any model timeout/fallback/private-model settings against live behavior after local changes. A bounded timeout is not proof that the provider meets the interactive latency target.
- [ ] Replay shared flow contracts through the implemented agent and Android state machine; then verify real confirm/PIN/explore/Back behavior. Parsing fixture messages alone is not runtime replay or proof of zero wrong payment taps.
- [ ] Leave unreached live/device/release gates explicitly open, and update task status only after each task's full requirements pass.
