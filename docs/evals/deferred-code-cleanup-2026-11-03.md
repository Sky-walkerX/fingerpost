# Deferred-code cleanup — 2026-11-03

The user requested an implementation check of notes that defer coding to later stages, then explicitly included both optional Day5 features. This overrides their cut condition for coding only. No phone, real media, model API, deployment, GCS upload, account/billing action or release tag was used.

| Deferred or stale note | Actual finding and resolution |
|---|---|
| A5-4 mock-glasses `FrameSource` | Missing. Implemented the source interface, CameraX adapter, debug-only local MP4 replay, preview/source labeling, monotonic looping timeline, dropped backlog and lifecycle drain. Normal/release camera behavior remains intact. [Procedure](../mock-glasses.md). |
| Synthetic replay clip preparation | Actual recorder invocation fails first with `ENOENT` on missing `video/out`; it now creates parents without overwriting a take. The unchanged recording flow completes all six synthetic screens. A 12.8 s/1280×800/no-audio H.264 MP4 is generated locally and remains ignored. A repeat capture is refused and its existing MP4 hash stays unchanged. Android decoding is unrun. |
| C5-4 Android donations | Gateway and consent docs existed, but capture/consent/redaction/PUT coding was absent. Implemented an off-by-default persisted setting; bounded redacted memory buffer; explicit, versioned local consent; numeric replay; validated/cancellable signed uploads. [Controls and acceptance](../donations.md). |
| Tester protocol says there is no voice/cloud client or PIN implementation | Stale. The actual client and native engine implement those paths; corrected processing disclosure and retained the prohibition on unaccepted physical testing/donation use. |
| Flow README says PIN simulator state/runtime replay come later | Stale. C4-1/A4-1/B4-2/C4-2 exist and have local tests. Updated the README without treating fixtures as physical safety evidence. |
| Local-development guide says planned skeletons may leave tests red | Stale for current source. Replaced with the actual passing-local/unaccepted-device distinction. |
| Web privacy/data-safety says a later beta may donate | Updated to the implemented off-by-default, per-task-consent behavior, memory buffering and pending redaction/retention acceptance. |
| Future iOS, real DAT glasses, Play/F-Droid and self-hosted SAM | Explicit future platform/channel/stretch goals, outside these Android MVP tasks. No alternate platform or unplanned dependency was introduced. |

## Implementation limits

Replay is a **synthetic debug source**, not real glasses or phone performance evidence. It accepts one fixed app-private MP4 file, never a URL/arbitrary activity-supplied path, and decodes no audio. Its frames enter the existing OCR/PIN/gateway path. Missing/corrupt video reports an actionable error. Media position loops without rewinding inference time; slow decode does not queue stale frames. Actual MP4 decoding/alignment and lifecycle checks await an authorized phone.

Donations retain no disk files and remain off by default. Enabling offers permits at most 20 face-covered, number-masked JPEGs in task memory; each task still needs approval after a failure. PIN/private/sensitive/basic protection, cancellation, successful task completion, lifecycle exit and final upload cleanup invalidate or wipe the buffer. Consent questions match `donate.v1` exactly in all three languages. Local-only voice listens after prompt completion; unclear/mixed replies, dismissal or 60 s without an answer decline. Explicit accessible buttons work without local recognition. Update and hardware speech cannot interrupt this turn.

Only already-redacted frames and numeric pose samples can reach storage. The entire grant is checked before the first PUT: exact file indices/kinds/sizes/headers, bounded JSON, current expiry/retention, HTTPS Google Storage destination, no userinfo/fragments and no redirects. Session authentication is attached only to the gateway metadata POST. PIN/lifecycle cancellation also interrupts a request stalled while reading response data. Already transmitted bytes cannot be recalled; actual no-upload and redaction evidence remains a physical acceptance gate. Cloud IAM, signed URL behavior and 90-day deletion are not proven by local transport tests.

## Validation

- Four replay timing tests fail for the missing API, then pass.
- Eight donation privacy/consent/ticket/zeroization/redaction tests fail for missing APIs, then pass; settings round-trip now includes the new off-by-default preference.
- Five loopback HTTP tests cover approved uploads without credential forwarding, refusal without consent, storage URL restrictions, all-destinations-before-first-PUT validation and cancellation during a stalled metadata body. No real image or external storage was used.
- Two Python consent checks bind the EN/HI/ES spoken questions to the versioned documentation and match Kotlin/gateway versions; missing client version fails first.
- **398 Android JVM tests** (guidance302, protocol54, app42), debug APK/test APK and lint pass: **0 errors, 16 existing warnings**.
- **705 TypeScript tests**, recursive typecheck/build and **80 Python tests** pass, including web accessibility checks. Existing assertions remain; no tests skipped/deleted or dependency pins changed.

## Remaining code decisions

1. **B5-2 name retention:** existing first-install control-label storage can retain a personal name, while design/ADR forbid it. Extending the two-install hash rule to controls changes an existing assertion; the previous decision request remains pending.
2. **B4-0 timeout:** the plan specifies 5 s, but current config/client/test/.env explicitly require a configurable 30 s default. A local content-free probe returns `{"configMs":30000,"clientMs":30000}`. Asked which policy is authoritative; neither timeout nor its tests were silently changed.

AGENTS.md §4 requires stopping on these spec/test conflicts. These are not unresolved skeleton bodies and cannot honestly be called completed by this implementation. Phone/cloud/live quality and release acceptance also remain open in [progress](../progress.md).
