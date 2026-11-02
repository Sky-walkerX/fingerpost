# Beta readiness and known issues

The beta is not yet accepted for public release. This page distinguishes known failures, unverified behavior and unfinished work. Synthetic tests and prepared deployment files do not demonstrate a safe physical task.

| Area | Current limitation | Required evidence or work |
|---|---|---|
| Live recognition | Earlier photo evaluation scored 6/10 correct targets; later five-second Spark probe timed out | Improve and remeasure quality/latency without weakening timeout policy; see progress evidence |
| Tracking | Prior physical runs missed the FPS/inference budget under thermal pressure | Controlled unthrottled performance and visual/TalkBack regression |
| PIN/payment | Local synthetic recall does not establish real-photo or physical payment safety | Real examples, no-upload evidence and zero wrong payment taps before release |
| Android changes | New update notices, release guards, low-vision overlays and EN/HI/ES localization are source-reviewed only; offline JVM execution stops on an uncached planned plugin | Teammate compilation, authored JVM tests, 200% text and device accessibility checks |
| Crash reporting | Crashlytics source integration is prepared with collection off by default | Android build/plugin checks, SDK retention/privacy review and console acceptance before enabling |
| Private mode | Adapter/deployment source exists; live Modal quality and cold/warm latency are unverified | Credential holder deploys and runs the private eval |
| Monitoring | Opt-in collector/exporter and disabled policy drafts are locally tested; deployment is unverified | Verify one active writer, metric-writer IAM, actual exports/policies and delivered notifications |
| Hosting/waitlist | Form requires configured HTTPS gateway; hosting/persistent public registration unverified | Verify production Firestore persistence, deploy and check registration |
| Signed release | Preflight/signature checks prepared; actual APK signing and clean-phone install unverified | Human supplies signing/Firebase configuration; teammate runs release acceptance |
| User evaluation | Consented tester sessions, tuning and 30-minute device soak remain open | Human recruitment/consent, actual trials and retained numeric evidence |
| Video | Script, shot list and release QR exist; footage/edit/submission remain open | Capture consented accepted takes and label development/proxy demonstrations accurately |

[Progress](progress.md) retains the task-specific gates. The [72-case bug-bash sheet](evals/bug-bash.csv) starts entirely NOT_RUN: six scenes × three languages × two hold modes × normal/private. Fill operator, tested revision and issue links after actual checks. Keep all images, audio, transcripts, OCR, device identifiers and personal details out of this sheet.
