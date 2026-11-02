# Day 6 coding checkpoint — 2026-11-03

The required independent coding through Day 6 is implemented. This continuation closes B6-3's budget worker/monitoring gaps and A6-1's cloud-speech fallback. It preserves the existing architecture, dependencies, wire schemas and every unfinished acceptance gate. **Day 6 is not complete for release.** No phone, real model, deployment, billing operation, release tag, test notification or tester contact was used for this continuation.

## Implemented and reviewed

- **B6-3:** a separate Cloud Run job entry consumes Pub/Sub through ADC, validates the configured account/budget/schema/currency/current monthly interval, and persists cloud disablement before acknowledging an actual spend breach. It never re-enables cloud. Batch/body bounds, request/process deadlines, content-free errors, retry behavior and gateway flag-cache integration are tested. Provisioning is documented in [budget-job.md](../budget-job.md); the job does not start with the gateway and adds no public HTTP surface.
- **B6-3:** the existing opt-in single-writer exporter now emits six health gauges even during idle traffic: heartbeat, task/parse sample counts, task/parse overflow and ledger-read health. Unknown aggregates remain omitted. The renderer adds disabled absence/overflow/ledger policies and a numeric dashboard, preserving the original strict error/parse/spend thresholds. [Monitoring](../monitoring.md) and [runbook](../runbook.md) cover activation and recovery.
- **A6-1:** basic mode exclusively creates Android's on-device recognizer on supported API31+ devices. It never falls back to the generic recognizer; missing services/models/permission fail safely. Per-utterance cleanup and generation checks reject callbacks after cancellation/replacement. Offline TTS selects installed non-network voices, permits the specified local English fallback, and displays an actionable localized message if no local output voice exists. Returning online clears stale speech queues before restoring ordinary voice selection.
- Existing Day 6 release workflow, waitlist/config endpoints, low-vision overlays, localized controls, launch page/QR, video script and shot list were examined and retained. Their local checks/builds pass where applicable; their external acceptance is listed below. Day 4 settings/privacy/PIN-route repairs remain intact.

## Validation

The budget and health regressions first failed on missing implementation/expected missing fields. Offline ASR and TTS tests first failed on the missing local-only interfaces. All then passed after implementation. Existing telemetry assertions now account for health series while retaining aggregate/timeout/privacy coverage and explicitly rejecting fabricated spend observations. No test was skipped or deleted, and no pinned dependency changed.

| Check | Verified result |
|---|---|
| `pnpm -r test` | 666 cases: protocol59, web53, gateway497, evals57; all pass |
| `pnpm -r typecheck` / `pnpm -r build` | Pass; gateway build includes `dist/budget-job.js` |
| `pnpm check:day2` | Two synthetic loopback scenarios pass; zero external calls |
| `node scripts/check-built-web.mjs` | Six pages, ten resources, three missing-route404 checks and custom404 artifact pass |
| `python3 -m unittest discover -s scripts -p 'test_*.py' -v` | 53 cases pass, including monitoring/release/deployment tooling |
| `./scripts/android.sh :core:guidance:test :core:protocol:test :app:test :app:assembleDebug :app:assembleDebugAndroidTest :app:lintDebug --console=plain` | Pass: guidance278, protocol54, app37; zero failures/errors/skips |
| Android lint | Zero errors,16 warnings; no new suppression/baseline |
| `pnpm audit --prod --json` | Zero high/critical; two existing moderate transitive minimatch/glob findings; pinned versions retained |

JVM speech tests use fake platform ports and sinks. They prove lifecycle/selection behavior, not real phone audibility, network isolation or audio routing. Web/loopback checks do not establish mobile acceptance. The dependency audit exits nonzero for the two moderate findings; it is not described as a clean audit.

## Day 6 task disposition

| Task | Coding/materials | What still prevents full completion |
|---|---|---|
| A6-1 | OCR resolver, engine wiring, local-only ASR/TTS and regressions implemented | Real phone: language packs, missing services/permissions, network loss/recovery, target behavior and no-network/no-PIN-upload evidence |
| A6-2 | 6dp outlines/rings, dark preview and accessible/localized controls compile | Accessibility Scanner, every-screen TalkBack and 200% text checks; [audit sheet](a11y-day6.md) remains NOT_RUN |
| A6-3 | EN/HI/ES strings, runtime language/rate and missing-voice handling implemented | Native-language device listen-through and corrections based on actual findings |
| B6-1 | Tag workflow, signing preflight, digest/checksum and APK verification implemented/tested locally | Human-provided secrets, production digest configuration, signed RC download and clean-phone installation |
| B6-2 | Waitlist/config endpoints and local boundary/cache tests pass | Actual Firestore persistence, Remote Config and production access/CORS acceptance |
| B6-3 | Budget job, telemetry/health, disabled policy/dashboard renderer, threat model and runbook implemented/tested | Approved cloud resources/IAM, publisher restrictions, job/scheduler, actual series/policies and delivered notifications |
| C6-1 | Page, release QR, HTTPS waitlist wiring, axe/build/HTTP checks pass | Firebase Hosting deployment and end-to-end production registration/download |
| C6-2 | Timed script, shot list and synthetic simulator sample prepared | Consented real appliance/phone/no-upload footage and final usable takes; synthetic sample is not device footage |
| C6-3 | Human session/outreach work, not an unimplemented application module | Consented tester session, quotes and owner-authored posts with alt text; no outreach/posting performed |

Optional Day 5 donation-device upload and mock-glasses stretch work remain deferred under the plan's cut rules. Tester-driven tuning needs actual findings. None of those is silently treated as implemented or accepted.

The next available action is a real-phone offline/accessibility/language pass after the user attaches a phone, followed by the pending signing/cloud checks when their human prerequisites exist. Day 7 freeze/tag remains blocked on the required exit and safety evidence; this report does not authorize a beta release.
