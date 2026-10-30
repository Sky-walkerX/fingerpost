# Eval (mock)

- date: 2026-10-30T13:32:36.941Z
- prompt: parse-screen.v1
- mode: mock

| Metric | Value |
|---|---|
| Items | 2 |
| Element precision | 40.0% |
| Element recall | 80.0% |
| Target hit rate | 50.0% |
| Screen-type accuracy | 50.0% |
| PIN/payment recall (n=1) | 0.0% |
| Latency p50 / p95 | 0 / 0 ms |
| Cost per parse | $0.0013 |

| Sample | Found | Extra | Type | Goals | ms |
|---|---|---|---|---|---|
| sample-001 | 4/5 | 1 | yes | ✓ ✗ | 0 |
| sample-002 | 0/0 | 5 | no | – | 0 |

Latency measures parsing only, not the complete guidance loop. Target hit uses the SAM polygon or the same Spark-box fallback as the gateway. Cost uses planning rates, not measured billing; mock mode makes no paid calls. Source filenames and recognized text are omitted.
