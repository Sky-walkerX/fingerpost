# Monitoring preparation

B6-3 runtime source and local checks are implemented; live acceptance remains with teammates. The gateway has an opt-in Cloud Monitoring REST exporter and bounded numeric collector. It can also render six **disabled** alert-policy drafts and a numeric dashboard locally. No cloud policy, production export or notification has been executed in this work session.

## What exists today

- `services/gateway/src/server.ts` wires the exporter only with `MONITORING_ENABLED=true`, authenticated live mode, a valid explicit `FIREBASE_PROJECT_ID` and `MONITORING_SINGLE_WRITER=true`. It uses application-default credentials and a fresh Firestore spend query, exports every 60 seconds, and stops on application close. Exports return within five seconds; uncancellable token/ledger work retains a latch until it settles, so repeated ticks cannot accumulate pending operations. Export failures log a content-free warning.
- `services/gateway/src/app.ts` enables Fastify HTTP request logging. A WebSocket HTTP upgrade is not a completed guided task; HTTP error rates cannot stand in for task error rates. Debug WebSocket logs include session IDs and are unsuitable as metric labels.
- `services/gateway/src/parse/spark-parse.ts` returns `latencyMs`; the Glimmer parse adapter also returns the parse result shape. The session observer now measures monotonic routed parse durations, including failures and retry/fallback time, independently of provider-reported `latencyMs`. Debug endpoints, explicit simulator sessions and mock mode are excluded.
- `services/gateway/src/quota/service.ts` records billed usage and receives a global daily microdollar total from `QuotaStore.addSpend`. `quota/firestore-stores.ts` persists it in the UTC-day sharded ledger. The exporter reads the current UTC-day ledger directly; unknown, malformed, overflowing or failed reads are omitted rather than cached or represented as zero. The ledger's fail-closed behavior stays authoritative; an alert does not enforce the cap.

Cloud Run request counts, load-test reports, stored ledger records and returned model timings do not establish that the configured metrics below exist in production. No deployed measurements or notification delivery have been verified.

## Implemented single-writer contract

The source publishes these metric names. A single trusted gateway writer publishes one series per metric using monitored resource `global`, resource label `project_id`, and **no metric labels**. Each metric is `GAUGE` / `DOUBLE`. Do not add user, session, request, email, IP, device, recognized text, provider error text, UTC day or revision labels. Numeric UTC timestamps belong in point intervals; revision belongs in a restricted incident record. All six health gauges are emitted even when traffic is idle or a ledger read fails, provided credentials and the Monitoring API work. Failed credential/HTTP/ledger timeouts cannot manufacture a successful heartbeat. This keeps the series count fixed at nine per project.

| Proposed `custom.googleapis.com/fingerpost/` suffix | Unit | Value emitted every 60 seconds | Alert draft |
|---|---|---|---|
| `task_error_ratio` | `1` | Errors / (successes + errors) among terminal admitted tasks in the trailing 300 seconds, within the single active production writer | Strictly >0.05 |
| `parse_p95_seconds` | `s` | Nearest-rank p95 of production routed `parseScreen` operation durations in the trailing 300 seconds, within the single active gateway writer | Strictly >5 |
| `daily_spend_micros` | `1` | Current UTC day's authoritative total ledger microdollars | Strictly >0.8 × configured cap in microdollars |
| `export_heartbeat` | `1` | Real export heartbeat, always 1 even during idle traffic | Absent for 180 seconds |
| `task_samples`, `parse_samples` | `1` | Explicit retained sample counts, zero when idle | Dashboard context |
| `task_overflow`, `parse_overflow` | `1` | 0/1 bounded-window overflow flags | Strictly >0 |
| `spend_read_ok` | `1` | 1 only after a current-day valid ledger read, 0 when unavailable | Strictly <1 |

The task instrumentation must count each admitted task once at its terminal outcome. Exclude health requests, handshake/auth rejection, pre-admission quota rejection, simulator traffic, local/mock runs and user cancellation from both task counts. A task ending in a gateway/model failure after admission counts as an error. The pipeline starts a once-only terminal closure after task admission. Successful guide verification, explore summaries and agent completion count success; final model/accounting/budget errors count failure. Replacing a goal, aborting, payment refusal and session disposal cancel an unfinished count. Retry frames do not double-count a task; stale parse failures cannot finish a replacement task.

Measure routed parse operations at the session/router boundary using a monotonic clock, including failed or timed-out operations at actual elapsed duration. One operation includes its provider retry/fallback chain; it is not an individual HTTP-attempt metric. This covers Spark and Glimmer while excluding segmentation, ASR and planner calls. The collector retains at most 10,000 numeric task samples and 10,000 parse samples per five-minute window. Overflow suppresses the affected metric until a clean window is available. Exact nearest-rank p95 is computed over retained complete windows. No content or identifiers are retained.

**Single writer is an operational requirement, not a distributed lock.** `MONITORING_SINGLE_WRITER=true` is an explicit operator assertion. Ensure one active serving instance/revision with no traffic split or revision overlap before enabling. `--max-instances=1` alone does not establish this during deployments. Multi-instance or multi-revision deployment needs a shared aggregator/lease and merged duration data before p95; averaging percentiles or enabling this exporter on multiple writers is unsupported. The defaults remain disabled until a teammate verifies that topology.

Do not emit an error ratio with no terminal task samples or a p95 with no parse samples. Do not substitute zero for missing samples. The spend exporter must read the current UTC-day ledger, emit a real zero after a verified day reset, and stop publishing on ledger failure. Do not publish the last successful total as a fresh observation. The cap passed to the renderer must match the deployed gateway's actual daily cap; the script cannot verify that. The gateway's `DAILY_CAP_USD` configuration is the operator's source, not an assumed example value.

The drafts align each already-aggregated gauge with `ALIGN_MAX` over 60 seconds and require a breach for 60 seconds. Task and parse values themselves cover a trailing five-minute window. These are initial operational settings for review, not guidance behavior thresholds. Missing data uses `EVALUATION_MISSING_DATA_NO_OP`: it does not create healthy zero samples or establish healthy service. A heartbeat absence policy (180 seconds, initial operational value) distinguishes a failed exporter from an idle but healthy one. Sample counts and overflow/read-health gauges are included in the dashboard draft. Verify the initial heartbeat has reached Cloud Monitoring before enabling absence detection; an unobserved series is not proof of a healthy or broken exporter. Unknown aggregates remain omitted; zero sample counts do not create fake zero error ratios or latency.

## Render and inspect locally

Use a new output directory whose parent exists and has no symlink components. On macOS use the canonical `/private/tmp` path, because `/tmp` is a symlink. The notification destination must be an existing resource in the intended project; the renderer validates its shape and project, not its existence or delivery.

```bash
python3 infra/monitoring/generate.py \
  --project synthetic-project \
  --daily-cap-usd 12 \
  --notification-channel projects/synthetic-project/notificationChannels/12345 \
  --output-dir /private/tmp/fingerpost-alert-drafts

python3 -m unittest scripts/test_monitoring_config.py
```

The example uses synthetic identifiers. The renderer writes six policies: `task-errors.json`, `parse-latency.json`, `daily-spend.json`, `heartbeat.json`, `overflow.json` and `ledger.json`, all with `enabled: false`, plus `dashboard.json`. The original three strict thresholds are preserved. It refuses existing destinations, symlink paths, malformed projects, a notification channel from another project, nonpositive/nonfinite caps and caps finer than one microdollar. No dependency installation is needed. Generated files need not be committed.

The JSON shape follows Google's [AlertPolicy / MetricThreshold API](https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.alertPolicies). The [API policy guide](https://docs.cloud.google.com/monitoring/alerts/policies-in-api) describes creation and testing. Neither an offline schema review nor this renderer substitutes for server-side validation in the actual project. The renderer deliberately retains normal metric-existence validation; do not bypass it to make absent telemetry look configured.

## Remaining acceptance

1. Local implementation checks cover once-only task accounting, stale/cancelled results, simulator/mock exclusions, exact bounded-window p95, overflow, fresh spend, UTC rollover, HTTP failure and timeout behavior. No new dependency is used. Teammates still verify least-privilege metric-writer IAM, actual single-writer topology and credential/project correctness before enabling.
2. In the intended project, inspect descriptors and real time series, validate the cap against runtime configuration, and import/review the prepared heartbeat policy and sample-count dashboard. Review the notification channel and access with its owner. This needs cloud setup; it has not been run.
3. Have the operator create the disabled policies, verify filters/units/window alignment against actual series, and review threshold boundaries (exactly 5%, 5 seconds or 80% does not breach). Verify no samples remain unknown and do not appear healthy.
4. Enable only after review. Exercise each condition with controlled synthetic telemetry in an isolated test project, prove recovery and missing-data handling, and record a delivered test notification, UTC time, policy IDs, window, destination resource and owner. Do not route test measurements into production metrics or manufacture billed calls to cross the cap.
5. Link numeric evidence in the progress log and [incident runbook](runbook.md). Keep B6-3 blocked until production policy configuration and notification acceptance are complete. No notification, deployment or billing action is authorized by running the local renderer.

The separate budget-stop job is documented in [budget job setup](budget-job.md). It consumes authenticated Pub/Sub deliveries using IAM/ADC rather than adding a public budget endpoint. No cloud setup or execution is claimed.
