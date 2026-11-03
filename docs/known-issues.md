# Beta readiness and known issues

The beta is not yet accepted for public release. This page distinguishes known failures, unverified behavior and unfinished work. Synthetic tests and prepared deployment files do not demonstrate a safe physical task.

The [Day 7 gate report](evals/report-v1.md) remains BLOCKED. Its [checker](release-readiness.md) requires actual revision-bound evidence; it does not turn these unverified limitations into measured passes. No release tag, real bug bash or two-phone soak was performed for the local Day 7 coding continuation.

| Area | Current limitation | Required evidence or work |
|---|---|---|
| Live recognition | Earlier photo evaluation scored 6/10 correct targets; later five-second Spark probe timed out | Improve and remeasure quality/latency without weakening timeout policy; see progress evidence |
| Tracking | Prior physical runs missed the FPS/inference budget under thermal pressure | Controlled unthrottled performance and visual/TalkBack regression |
| PIN/payment | Local synthetic recall does not establish real-photo or physical payment safety | Real examples, no-upload evidence and zero wrong payment taps before release |
| Android changes | JVM tests, debug APK/test APK and lint pass; real UI/audio behavior remains unverified for the new settings, low-vision overlays and languages | 200% text, TalkBack, installed voices, actual PIN earphone routing and foreground/background checks |
| Offline speech | Basic mode now requires the on-device ASR service (API31+) and local TTS voices; old/missing services fail safely | Phone language-pack/permission/reconnection checks and evidence of no network speech fallback; API24–30 basic-mode speech input is unavailable |
| Crash reporting | Android debug builds pass with collection off by default; Firebase-enabled and opt-in release behavior remain unverified | Configured release/plugin/manifest checks, SDK retention/privacy review and console acceptance before enabling |
| Optional replay/donations | Mock-glasses replay and Android donation coding now pass local checks; no physical or cloud acceptance | Approved debug MP4 pause/alignment checks; donation consent, redaction, PIN cancellation and bucket lifecycle/IAM checks before tester use |
| Shared kiosk memory | A first-install control label may retain a personal name; storage spec/test conflict awaits a decision | Resolve B5-2 policy and add the named-control regression before enabling shared memory on personal screens |
| Private mode | Adapter/deployment source exists; live Modal quality and cold/warm latency are unverified | Credential holder deploys and runs the private eval |
| Monitoring | Opt-in collector/exporter, health gauges, six disabled policy drafts and dashboard are locally tested; deployment is unverified | Verify one active writer, metric-writer IAM, actual exports/policies and delivered notifications |
| Budget stop | A bounded ADC Pub/Sub job disables the cloud flag for the allowlisted fixed monthly budget; cloud setup is unrun | Approved project/budget/timezone, publisher/IAM restrictions, job/scheduler setup, durable flag and retry acceptance; billing notifications are delayed, not hard caps |
| Hosting/waitlist | Form requires configured HTTPS gateway; hosting/persistent public registration unverified | Verify production Firestore persistence, deploy and check registration |
| Signed release | Preflight/signature checks prepared; actual APK signing and clean-phone install unverified | Human supplies signing/Firebase configuration; teammate runs release acceptance |
| User evaluation | Consented tester sessions, tuning and 30-minute device soak remain open | Human recruitment/consent, actual trials and retained numeric evidence |
| Video | Script, shot list and release QR exist; footage/edit/submission remain open | Capture consented accepted takes and label development/proxy demonstrations accurately |

[Progress](progress.md) retains the task-specific gates. The [72-case bug-bash sheet](evals/bug-bash.csv) starts entirely NOT_RUN: six scenes × three languages × two hold modes × normal/private. Fill operator, tested revision and issue links after actual checks. Keep all images, audio, transcripts, OCR, device identifiers and personal details out of this sheet.
