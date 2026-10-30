# Day 1 ten-photo smoke diagnostic — 2026-10-30

**Decision: reject the low-reasoning candidate for production.** All ten photos completed and all ten overlays were inspected in a local browser. Six targets are on the correct button, below the required eight. A returned polygon is not a quality pass. D1-T5 and the Day 1 quality exit check remain unmet.

## Request profile and limits

- Same ten user-authorized public appliance JPEGs and existing Standard Spark 1.3/SAM 3.1 adapters, prompt, strict schema, locale and first-non-text-element selection.
- Experimental Spark request field: `reasoning_effort: low`. Each request had a 60,000 ms diagnostic bound, zero SDK retries and a bounded response-body signal. This is an offline diagnostic, not the production smoke request policy or an app latency measurement.
- At this diagnostic revision the production client was at 15,000 ms and one retry, with reasoning effort omitted/model-set. No prompt, model, dependency, protocol or acceptance threshold changed. **Later B4-0 supersedes only the client deadline/retry policy with the plan's five-second/zero-retry bound; it has not been live-revalidated.** See [current hardening evidence](day4-gateway-hardening.md).
- The first low-reasoning attempt stopped at sample 6's SAM box call with `APIConnectionTimeoutError`; five complete overlays and sample 6's Spark metrics remain private. Its partial results are not mixed into the tables below. The subsequent run uses the corrected failure-preserving runner and completes all 30 calls with no retries or model-call errors.
- One complete ten-photo diagnostic does not establish reliability or compare accuracy against a completed default-reasoning baseline. Spark ordering and output varied between attempts.
- Spark alone takes 9,655 ms p50 / 14,907 ms p95, already exceeding the documented first-parse targets of 2,500 / 4,000 ms. Complete Android/keyframe-to-target latency was not measured here. Enlarging a diagnostic timeout is not an interactive latency fix.

## Manual target review

Review criterion: green polygon falls on the visible button indicated by the orange box, rather than surrounding panel, decoration or a different control. This is the plan's visual smoke check, not an IoU score or an end-to-end goal/press verification. No recognized labels are retained.

| Sample | Correct button | Observation |
|---|---|---|
| 1 | Yes | Polygon on the selected button. |
| 2 | No | Initial box is displaced; mask falls on adjacent blank panel. |
| 3 | Yes | Polygon on the selected small button. |
| 4 | Yes | Polygon on the selected touch control. |
| 5 | No | Initial box overlaps decoration/neighboring control; mask selects the adjacent control. |
| 6 | No | Initial box and mask lie above the visible button. |
| 7 | Yes | Polygon follows the selected button. |
| 8 | Yes | Polygon follows the selected button. |
| 9 | Yes | Polygon on the selected button despite glare. |
| 10 | No | Prompt spans neighboring buttons; mask selects the lower control. |

**Correct targets: 6/10. Required: at least 8/10. Result: fail.** Wrong initial boxes are a recurring pattern; mask presence cannot repair an incorrect target prompt. Inspecting the parser implementation confirms the existing documented local-raster/bounds offset and box-coordinate conventions; no coordinate-conversion defect was established. This is not proof that every adapter or model path is correct. The prompt is unchanged, as D1-T5 specifies; future prompt changes require the documented evaluation workflow.

## Complete-run numerical output

### Generated smoke metrics (2026-10-30T13:08:29.548Z)

Run status: completed.

Samples attempted: 10/10. Samples completed without model errors: 10/10. Failed model calls: 0.

Target polygons present: 10/10.

Correct target polygons: 6/10 after the manual review above. Polygon presence alone does not establish correctness.

| Sample | Elements | Spark ms | SAM box ms | Target present | SAM text ms | Screen present | Tokens in/out | Call status |
|---|---|---|---|---|---|---|---|---|
| 1 | 24 | 13148 | 3368 | 1 | 3663 | 0 | 2413/2787 | Spark ok; SAM box ok; SAM text ok |
| 2 | 16 | 9813 | 3189 | 1 | 2534 | 0 | 2079/2032 | Spark ok; SAM box ok; SAM text ok |
| 3 | 17 | 14332 | 5724 | 1 | 2683 | 0 | 3505/2415 | Spark ok; SAM box ok; SAM text ok |
| 4 | 15 | 9163 | 4042 | 1 | 3307 | 0 | 2413/1923 | Spark ok; SAM box ok; SAM text ok |
| 5 | 11 | 10050 | 3365 | 1 | 4763 | 0 | 2413/1499 | Spark ok; SAM box ok; SAM text ok |
| 6 | 11 | 9655 | 2976 | 1 | 2631 | 0 | 2355/1658 | Spark ok; SAM box ok; SAM text ok |
| 7 | 25 | 14907 | 6516 | 1 | 3479 | 1 | 3583/2737 | Spark ok; SAM box ok; SAM text ok |
| 8 | 21 | 7600 | 2408 | 1 | 2644 | 0 | 3583/1818 | Spark ok; SAM box ok; SAM text ok |
| 9 | 15 | 8813 | 3770 | 1 | 3053 | 1 | 2773/1829 | Spark ok; SAM box ok; SAM text ok |
| 10 | 13 | 7718 | 2863 | 1 | 2102 | 0 | 2413/1600 | Spark ok; SAM box ok; SAM text ok |

Successful calls only; failed or unfinished calls are excluded from latency percentiles.

| Call | Successful calls | p50 ms | p95 ms |
|---|---|---|---|
| Spark parse | 10 | 9655 | 14907 |
| SAM box | 10 | 3365 | 6516 |
| SAM text | 10 | 2683 | 4763 |

Average input tokens per successful parse: 2753. Estimated cost of successful calls using Day 1 planning rates (not measured billing): $0.1707. Failed or unfinished calls may also be billed; this is not the total run cost.

Review overlays remain in ignored local storage: blue = Spark boxes, orange = selected box prompt, green = SAM target. No photo, source filename or recognized label is included in this report.
