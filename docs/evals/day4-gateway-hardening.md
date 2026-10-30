# B4-0: contracts and gateway hardening

Verified locally on 2026-10-30. The user deferred GCP-dependent testing until an account is available and authorized independent local development. B4-0 has no cloud/device acceptance step; completing it does not complete any earlier blocked task.

## Implemented

- Four synthetic fp.v1 flow contracts cover guide, multi-step payment confirmation/PIN entry, explore and Back recovery. Nine TypeScript checks and four Kotlin cases validate the contracts. They are inputs for future runtime replay, not evidence of an implemented agent or device payment/PIN safety.
- A validated abort bypasses pending session work and discards its queued messages. An initial buffered hello still runs first. Ordinary locate/verify messages retain arrival order; malformed aborts do not bypass validation.
- Each pipeline task has an AbortController. Abort, a replacement goal or disposal releases pending pipeline waits and suppresses stale layouts, targets and refusals. Successful model calls that finish afterward still record usage. Aborted tasks cannot send free verification frames.
- A delayed ASR quota check cannot reopen the old relay or publish an error into the next turn. A stalled old quota check does not block the next goal after abort.
- The shared Meta SDK client now uses the plan's **5,000 ms timeout and zero SDK retries**. ASR WebSocket upgrades have a **5,000 ms handshake timeout**. Standard model IDs and the parse prompt are unchanged.

## Test-first evidence

The initial hardening run had **11 expected failures and one pass**: missing cancellation, queued abort, old SDK policy and absent ASR timeout failed; the existing no-goal guard passed. Further regressions reproduced a stalled ASR quota backlog, a late quota error after abort, and cancellation trapped behind buffered startup messages before each fix. All **17 new gateway cases** now pass; existing tests were retained.

| Verification | Result |
|---|---|
| `pnpm -r test` | **389 passed**: gateway 276, protocol 57, web 20, evaluator 36 |
| `pnpm -r typecheck` | Passed |
| `pnpm -r build` | Protocol, web and gateway passed |
| `python3 -m unittest discover -s scripts -p 'test_*.py' -v` | **31 passed**, including stubbed deployment tests; no cloud calls |
| `./scripts/android.sh :core:guidance:test :core:protocol:test :app:test :app:assembleDebug --console=plain` | Passed using up-to-date Android outputs; stored XML has 148 guidance, 53 protocol and five app cases, zero failures/errors/skips. The four new Kotlin contract cases executed during the first B4-0 commit's verification. |
| Compiled gateway, native Node, actual loopback HTTP/WebSocket | Health 200; abort during an indefinitely stalled synthetic model returned `finish{aborted}` in **1.06 ms** in one smoke sample |
| `git diff --check` | Passed |

The 50 ms regression checks and one loopback sample establish local cancellation behavior, not device/network percentile latency. Tests use synthetic inputs and injected models/fetch/socket behavior; no paid provider call or real capture was used.

## Limits and next work

Cancellation is logical: stale output is dropped immediately, while an already-issued provider request may still finish and be billed. The SDK deadline bounds those requests; it does not establish remote cancellation or improve model inference speed.

The new five-second policy is the explicit Days 4–7 requirement, replacing the historical 15-second/one-retry policy. Existing real-photo diagnostics already exceeded five seconds. **No claim of live success under the new deadline is made.** B4-1 must add model routing/fallback; B5-3 adds the breaker/fallback chain. Revalidate the resulting policy and all earlier live/cloud gates with the [deferred checklist](cloud-revalidation.md).

Next backend task: **B4-1 model router**. B4-2 agent loop, A4-1 device task turns and C4-2 virtual flow runner can consume the new contracts when their respective prerequisites are met. GCP/ADR-0003, real quality labels, phone/tablet acceptance, tracking performance and release gates remain open.
