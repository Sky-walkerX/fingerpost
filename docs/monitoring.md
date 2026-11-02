# Monitoring preparation

B6-3 remains blocked. This repository can render three **disabled** Cloud Monitoring alert-policy drafts locally. It does not export their measurements, create metric descriptors, call Google Cloud, change billing or send notifications. An operator must implement and validate telemetry before creating or enabling these policies.

## What exists today

- `services/gateway/src/app.ts` enables Fastify HTTP request logging. A WebSocket HTTP upgrade is not a completed guided task; HTTP error rates cannot stand in for task error rates. Debug WebSocket logs include session IDs and are unsuitable as metric labels.
- `services/gateway/src/parse/spark-parse.ts` returns `latencyMs`; the Glimmer parse adapter also returns the parse result shape. These are internal return values, not exported latency distributions. The mock parser's zero latency is synthetic and must never enter production measurements.
- `services/gateway/src/quota/service.ts` records billed usage and receives a global daily microdollar total from `QuotaStore.addSpend`. `quota/firestore-stores.ts` persists it in the UTC-day sharded ledger. Neither exports a Monitoring metric. The ledger's fail-closed behavior stays authoritative; an alert does not enforce the cap.

Cloud Run request counts, load-test reports, stored ledger records and returned model timings do not establish that the proposed metrics below exist. No deployed measurements or notification delivery have been verified.

## Proposed exporter contract (unimplemented)

These metric names are a proposal, not an active instrumentation API. A single trusted project-level aggregator must publish one series per metric using monitored resource `global`, resource label `project_id`, and **no metric labels**. Each metric is `GAUGE` / `DOUBLE`. Do not add user, session, request, email, IP, device, recognized text, provider error text, UTC day or revision labels. Numeric UTC timestamps belong in point intervals; revision belongs in a restricted incident record. This keeps the series count fixed at three per project.

| Proposed `custom.googleapis.com/fingerpost/` suffix | Unit | Value emitted every 60 seconds | Alert draft |
|---|---|---|---|
| `task_error_ratio` | `1` | Errors / (successes + errors) among terminal admitted tasks in the trailing 300 seconds, across the production gateway | Strictly >0.05 |
| `parse_p95_seconds` | `s` | Nearest-rank p95 of production `parseScreen` attempt durations in the trailing 300 seconds, across all gateway instances | Strictly >5 |
| `daily_spend_micros` | `1` | Current UTC day's authoritative total ledger microdollars | Strictly >0.8 × configured cap in microdollars |

The task instrumentation must count each admitted task once at its terminal outcome. Exclude health requests, handshake/auth rejection, pre-admission quota rejection, simulator traffic, local/mock runs and user cancellation from both task counts. A task ending in a gateway/model failure after admission counts as an error. Define the terminal hooks against the task lifecycle and test retries/reconnects before shipping instrumentation; no such hooks are supplied here.

Measure parse attempts at the router boundary using a monotonic clock, including failed or timed-out attempts at their actual elapsed duration. This covers Spark and Glimmer while excluding segmentation, ASR and planner calls. Aggregate raw durations or mergeable distributions across instances **before** computing p95; averaging instance percentiles is invalid. The aggregator must retain only bounded numeric histogram/count data or a bounded numeric window, never request content. Prove p95 with synthetic inputs, including failures, timeouts and multiple instances.

Do not emit an error ratio with no terminal task samples or a p95 with no parse samples. Do not substitute zero for missing samples. The spend exporter must read the current UTC-day ledger, emit a real zero after a verified day reset, and stop publishing on ledger failure. Do not publish the last successful total as a fresh observation. The cap passed to the renderer must match the deployed gateway's actual daily cap; the script cannot verify that. The gateway's `DAILY_CAP_USD` configuration is the operator's source, not an assumed example value.

The drafts align each already-aggregated gauge with `ALIGN_MAX` over 60 seconds and require a breach for 60 seconds. Task and parse values themselves cover a trailing five-minute window. These are initial operational settings for review, not guidance behavior thresholds. Missing data uses `EVALUATION_MISSING_DATA_NO_OP`: it does not create healthy zero samples or establish healthy service. A separate exporter heartbeat/freshness check and an operator view of sample counts are prerequisites for activation; idle traffic and exporter outage must be distinguishable. These drafts alone do not detect telemetry loss.

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

The example uses synthetic identifiers. The renderer writes `task-errors.json`, `parse-latency.json` and `daily-spend.json`, all with `enabled: false`. It refuses existing destinations, symlink paths, malformed projects, a notification channel from another project, nonpositive/nonfinite caps and caps finer than one microdollar. No dependency installation is needed. Generated files need not be committed.

The JSON shape follows Google's [AlertPolicy / MetricThreshold API](https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.alertPolicies). The [API policy guide](https://docs.cloud.google.com/monitoring/alerts/policies-in-api) describes creation and testing. Neither an offline schema review nor this renderer substitutes for server-side validation in the actual project. The renderer deliberately retains normal metric-existence validation; do not bypass it to make absent telemetry look configured.

## Remaining acceptance

1. Implement the exporter and lifecycle hooks, with content-free telemetry, least-privilege access and no dependency/version changes without repository approval. Verify bounded cardinality, correct terminal accounting, merged p95, fresh spend, UTC rollover and failure/missing-data behavior locally.
2. In the intended project, inspect descriptors and real time series, validate the cap against runtime configuration, and establish exporter heartbeat/sample-count monitoring. Review the notification channel and access with its owner. This needs cloud setup; it has not been run.
3. Have the operator create the disabled policies, verify filters/units/window alignment against actual series, and review threshold boundaries (exactly 5%, 5 seconds or 80% does not breach). Verify no samples remain unknown and do not appear healthy.
4. Enable only after review. Exercise each condition with controlled synthetic telemetry in an isolated test project, prove recovery and missing-data handling, and record a delivered test notification, UTC time, policy IDs, window, destination resource and owner. Do not route test measurements into production metrics or manufacture billed calls to cross the cap.
5. Link numeric evidence in the progress log and [incident runbook](runbook.md). Keep B6-3 blocked until production policy configuration and notification acceptance are complete. No notification, deployment or billing action is authorized by running the local renderer.
