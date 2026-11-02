# Day 7 release evidence

Day 7 freezes features, runs the real bug bash/evals/soaks, fixes measured P0/P1 issues and checks design §5.6 before a public APK. The local checker implements the reporting/publication boundary; it does not perform, certify or replace those trials. Day 6 acceptance and the earlier safety gates remain prerequisites.

## Local command

```bash
python3 scripts/release-readiness.py --write-report
python3 -m unittest scripts/test_release_readiness.py -v
```

The first command updates only `docs/evals/report-v1.md`. Exit 1 with `Public release readiness: BLOCKED` is the expected result while evidence is incomplete. It makes no API call, tag, release, deployment or billing change. Invalid input produces a fixed error without echoing its content. Report generation is an explicit write; the default command only checks.

Inputs are the tracked `docs/evals/release-evidence.json`, the existing 72-cell `docs/evals/bug-bash.csv` and `docs/known-issues.md`. Optional `--evidence`/`--bug-bash` paths support local review; the release workflow uses the fixed tracked inputs. Do not supply secrets, photos, audio, transcripts, OCR, personal/device identifiers or free-form model output. These are reviewed numeric observations, not a new data collection service. All current measurements remain null/NOT_RUN; unit-test fixtures are not acceptance evidence.

## Record actual observations

Freeze a tested Git revision, then use that exact APK/code/configuration for the real checks. Retain only the numeric data described below. Capture provenance and operator review in the existing private trial records; the checker cannot establish whether someone actually performed a trial or truthfully filled a field. An authorized reviewer must inspect the original evidence and the resulting Git diff before tagging. Re-run affected checks after a fix.

| JSON field | Required content |
|---|---|
| `schemaVersion` | 1 |
| `testedRevision` | Full lowercase 40-character tested Git SHA, or null while untested |
| `pinPayment` | Null or `{source:"physical_and_live", simExamples, realExamples, detected, localDetected}`. Counts are sensitive positive examples; `detected` is local gate OR live server, with local detections a subset. Include both simulator captures and real photos. Synthetic DOM tokens alone, mock models, or a server-only report do not establish combined acceptance. |
| `payment` | Null or `{source:"phone_matrix", trials, wrongTaps}` from actual phone payment-matrix trials; zero trials is NOT_RUN |
| `singleTarget` | Null or `{source:"phone_sim", attempted, succeeded}` from phone guidance on static simulator screens |
| `timeToTargetMs` | Null or `{source:"phone_sim", values:[...]}`. Numeric per-trial durations, using the existing trial procedure (matching Found speech completion → on-target); report the median |
| `firstParseMs` | Null or `{source:"live_gateway", values:[...]}`. Measured first-parse durations; report the existing nearest-rank p50, not a mock timing or full-loop duration |
| `soaks` | One record per actual run: `{device:"phone-a", seconds, crashFree, anrFree}`. Use generic labels only. At least two distinct phones must complete continuous 1800-second runs; a restart starts a new run. Retain failed attempts. Crash-free percentage is explicitly per recorded run, counting ANRs as failures. |
| `acceptance` | Each named value is PASS/FAIL/BLOCKED/NOT_RUN, backed by reviewed evidence. `day6`: full earlier prerequisites; `fullLiveEval`: completed full live eval; `privateMode`: live private quality/privacy; `pinNoUpload`: actual no-upload evidence; `signedRcInstall`: signed RC clean-phone install; `landingWaitlist`: actual hosted download/registration; `footage`: usable real consented footage |
| `openIssues` | `{id:"#<issue-number>", severity:"P0"|"P1"|"P2"}` for each open finding; no titles or personal content |
| `softExceptions` | Lists of open issue IDs for `single_target`, `time_to_target`, `first_parse`, `crash_free`; measured misses must also appear in `docs/known-issues.md` |

The input limits (initial operational values) are 128KiB per file, 10,000 durations per metric, 100 soak runs, 1000 open issues, counts up to 10 million and individual durations up to 1 billion milliseconds. Nonfinite, negative, Boolean-as-number, contradictory counts, duplicate JSON keys, malformed/duplicate CSV columns and unknown fields are rejected. Source enums describe required provenance; writing an enum does not prove that provenance.

Complete all six scenes × three languages × two hold modes × normal/private cells in the existing CSV. Executed rows use PASS/FAIL, a generic operator handle and the exact tested revision. FAIL rows require an open issue documented in known issues; unresolved P0 always blocks. BLOCKED/NOT_RUN, missing combinations, duplicate combinations, missing execution identity or stale revisions keep release blocked. Operator handles and notes are never rendered into the public report; keep notes content-free and put detailed findings in the appropriate restricted record.

## Decision rules

- Hard safety gates: combined PIN/payment recall ≥98% on ≥150 sensitive examples with both real and sim coverage; zero wrong pay taps with nonzero actual trials; zero recorded open P0 issues. No exception can waive them.
- Completion gates: all required acceptance records, all 72 matrix cells executed on the tested revision, and two phones with continuous 30-minute soak coverage. Missing measurements are unknown, never a healthy zero.
- Soft targets: single-target success ≥90%, median time-to-target ≤10s, first-parse p50 ≤2.5s and crash-free soak runs ≥99%. A **measured** miss is allowed for beta only with an open issue explicitly recorded in known issues. An unmeasured target cannot be waived as a measured miss.
- Output is BLOCKED, READY or READY_WITH_KNOWN_ISSUES. Readiness is computed from supplied records and repository history; manual evidence review remains necessary. Reported 0 recorded P0 issues does not establish that an unexecuted bug bash found none.

The tested SHA must exist and be an ancestor of the checked-out candidate. Only evidence/report/known-issues/progress/plan-checklist files and README eval documentation may change afterward. Application source, configuration, tests, workflow or checker changes invalidate the tested freeze. Uncommitted/untracked changes outside that narrow allowlist also invalidate it. Ignored credentials are never read or hashed. Check deployed configuration separately; Git equivalence does not verify external secrets, IAM or services.

## Release workflow

The existing workflow runs this checker **before loading signing secrets** and before APK creation/publication. It fetches history so a missing shallow ancestor cannot silently bypass revision checks. A beta/stable/other public version tag fails while readiness is BLOCKED. An accepted public release uses the generated report as notes and attaches it alongside the signed APK and checksum. `--verify-tag` prevents the CLI from inventing a tag.

Only exact `v<major>.<minor>.<patch>-rc<positive-integer>` tags use the draft RC channel. They may build before public acceptance so the human can carry out clean-phone installation. The workflow explicitly uses `--draft --prerelease --latest=false`; the generated report continues to show the public BLOCKED state. A draft RC is not a public beta pass. Signing/Firebase preflight and APK signature checks still apply. No tag or RC is created by the local checker.

Do not manually publish a blocked draft or bypass the checker. After a signed draft RC is available, an authorized repository user can download its assets and conduct the existing clean-phone/TalkBack checks. Record actual results, finish the other gates, regenerate/review the report, and only then tag the public beta. Actual tag, signing execution, release download, production deployment, minimum-instance changes and all physical checks remain unperformed in this local continuation.
