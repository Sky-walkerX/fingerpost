# Day 7 release report v1

Public release readiness: **BLOCKED**.

Tested code revision: NOT_RUN.

This report evaluates operator-supplied numeric evidence against design §5.6 and the Day 7 plan. It does not perform or independently authenticate physical trials. NOT_RUN is not a measured zero or a pass. A source build, synthetic unit test or draft RC does not establish public release acceptance.

| Gate | Kind | Status | Numeric evidence |
|---|---|---|---|
| tested_revision | required | NOT_RUN | No matching tested freeze |
| day6 | required | NOT_RUN | NOT_RUN |
| fullLiveEval | required | NOT_RUN | NOT_RUN |
| privateMode | required | NOT_RUN | NOT_RUN |
| pinNoUpload | required | NOT_RUN | NOT_RUN |
| signedRcInstall | required | NOT_RUN | NOT_RUN |
| landingWaitlist | required | NOT_RUN | NOT_RUN |
| footage | required | NOT_RUN | NOT_RUN |
| open_p0 | hard | PASS | 0 recorded open P0 issues |
| pin_recall | hard | NOT_RUN | Unmeasured |
| wrong_pay | hard | NOT_RUN | Unmeasured |
| single_target | soft | NOT_RUN | Unmeasured |
| time_to_target | soft | NOT_RUN | Unmeasured |
| first_parse | soft | NOT_RUN | Unmeasured |
| soak_coverage | required | NOT_RUN | 0 phones with 30-minute runs |
| crash_free | soft | NOT_RUN | Unmeasured |
| bug_bash | required | NOT_RUN | 0/72 executed; 0 failures |

Documented soft-gate exceptions: None recorded.

PIN/payment recall is local gate OR live server, with local recall shown separately, on at least 150 sensitive examples including sim captures and real photos. Wrong-pay evidence requires actual phone matrix trials. Time-to-target is the median; first-parse p50 uses the existing nearest-rank method. Crash-free is reported per completed soak run, with at least two phones and continuous 30-minute runs.

Hard safety failures cannot be waived. Measured soft misses require linked open issues in [known issues](../known-issues.md); unmeasured requirements remain blocked. [Evidence procedure](../release-readiness.md) describes scope and revision checks.
