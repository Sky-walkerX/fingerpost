# Local code completion and teammate gates

The user explicitly assigns live gates to teammates and asks this machine to finish code. All requested local implementation has been prepared on main: telemetry export/lifecycle instrumentation; Hosting and production-site checks; release input and APK signer verification; update notices, low-vision overlays and default-disabled crash reporting; language recovery guidance; QR, scripts, synthetic B-roll and bug-bash materials. This is **not** a claim that Android compiles or the beta passes safety gates.

## Teammate execution

| Gate | Entry point | Evidence required |
|---|---|---|
| Android compile and authored regressions | Existing `scripts/android.sh`, CI Android job; run guidance/protocol/app tests and debug/release builds | Real command results, including new NoticeCompletion, ReleaseVersion, Phrases and string tests; no skips to obtain green |
| Device accessibility/languages | Guidance, settings, permission, PIN and offline screens | TalkBack, 200% text, English/Hindi/Spanish listen-through and installed voices; real earphone/no-earphone behavior |
| Tracking, task and PIN safety | Existing device/rig procedures and `docs/evals/bug-bash.csv` | Actual budgets and task results, no PIN upload, zero wrong pay taps; every sheet row starts NOT_RUN |
| Live model and private eval | Existing eval CLI, regional scripts, `services/private-models/README.md` | Permissioned photos, retained content-free outcomes, quality/latency and selected region; no synthetic pass substituted |
| Cloud and monitoring | `docs/monitoring.md`, `docs/runbook.md`, `infra/monitoring/generate.py` | Correct project/IAM, one active writer/revision, fresh numeric series, disabled-policy validation, then delivered test notifications |
| Waitlist/Hosting | `docs/site-deployment.md`, `infra/firebase.json` | Persistent production registration, HTTPS/CORS, hosted headers/cache/404; mock in-memory registration does not qualify |
| Signed APK | Release workflow, `scripts/release-preflight.py`, `scripts/verify-release-apk.py` | Private signing/Firebase secrets and production gateway, matching certificate/digest, checksum and clean-phone install |
| Crash reporting | `docs/android-crash-reporting.md` | Build/plugin/manifest checks and reviewed SDK retention/disclosures before any opt-in reporting; default remains off |
| Human evaluation and footage | Tester/consent protocol, soak procedure, video shots/script | Actual consented sessions, tuning from findings, device soak, appliance/phone footage and final edit |

Do not post credentials or raw captures in Git, logs or chat. Account/key/billing creation and contacting testers remain human-owned. Configure secrets in the approved local environment or secret store. No live call, cloud deployment, test notification or release tag was performed here.

The optional mock-glasses source remains deferred under the plan's stretch/cut rule because the Day 5 device exit gate is not met. Tester-driven tuning and device phrasing acceptance depend on actual results; no guessed tuning or synthetic testimonial was added.

## Local artifacts

- `video/out/sim-demo/simulator-fastfood.mp4`: 12.64 seconds, 1280×800, visibly synthetic simulator-only B-roll, ignored by Git. Actual phone/cloud guidance is not shown.
- `apps/web/public/release-qr.png`: generated locally and independently decoded to the GitHub latest-release URL.
- `docs/evals/bug-bash.csv`: 72 unrun combinations for teammate execution.

Final verification totals and revision are recorded in the progress log after the concluding local checks. Android SDK/dependency resolution/build/device checks are deliberately unrun on this machine under the user's instruction.

## Concluding checks

644 TypeScript cases pass (protocol59/web53/gateway475/evals57), recursive typecheck/build pass, all52 Python tooling cases pass, and the actual built-site HTTP smoke verifies six pages, ten resources, three missing-route404s and the custom404 artifact. Localized Android XML/key parity/reference checks pass.

An offline pure-JVM attempt used the already-installed JDK21 and cached Gradle9.8.2 with configuration on demand. Root configuration stopped before tests because the newly planned Crashlytics3.0.8 plugin is not in the local cache. No dependency/SDK download or retry was made. Android tests remain unrun, including new source regressions; teammates must resolve the plugin, compile and execute them. This limitation must not be reported as green Android validation.

Late source completion includes localized engine recovery/movement/PIN speech and settings/session accessibility resources. Android system locale drives UI/TalkBack resources; the app language setting drives guidance/PIN voice. Missing-voice fallback warnings intentionally use English. See [language behavior](../android-localization.md).
