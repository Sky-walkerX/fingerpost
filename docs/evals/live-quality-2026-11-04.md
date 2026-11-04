# Live recognition quality: per-call diagnosis and two repairs (2026-11-04)

User-requested continuation of "Next engineering work" items 1–2 in [appliance-revalidation-2026-11-04](appliance-revalidation-2026-11-04.md). Real Standard models (Spark 1.3/1.2, SAM 3.1) through the production `SessionPipeline`, router and 60-second turn deadline, driven in-process on a laptop. **Not phone, cloud, latency-target or release acceptance.** Each case ran once per configuration; the results are single-run observations, not success rates.

## Inputs

- **7 positive + 1 negative public photos**, re-downloaded from the Commons sources listed in [appliance-multimedia-check-2026-11-03](appliance-multimedia-check-2026-11-03.md#public-sources-and-derivative-licenses), EXIF-rotated, resized to 1024 px wide and encoded at JPEG quality 80 (Keyframer's full-frame policy). One typed goal per photo; no local quad hint, which is stricter than the phone. The negative (knob-only microwave) asks for a start button.
- **5 synthetic flat touchscreens:** simulator screens (fastfood menu, cooktop panel, ticket destinations, check-in booking, adversarial home) composited into a bezel on a wall background. These carry the phone-style local quad hint, because Android sends a full keyframe only after a stable local quad (§1).
- One manual reference box per positive. A result is aligned when the target centroid, projected back through `layout.screenQuad`, falls inside it.
- Raw media, model output, overlays and the driver remain in ignored `evals/datasets/private/appliance-2026-11-04-mac/`. The driver records only model id, prompt id, SAM concept (fixed allowlist) or `box`, HTTP status, latency and token counts.

## Diagnosis

| Finding | Evidence |
|---|---|
| Spark 1.3 parse is too slow on photos, not flaky | Baseline: 1.3 hit the 30 s call bound in 6/8 photo parses; the 2 that answered took 29.1 and 29.9 s. Spark 1.2 completed all 6 fallbacks in 11.6–15.6 s. Photo parses write about 2,800–3,400 output tokens (≈110 tok/s for 1.3 versus ≈230 tok/s for 1.2); synthetic screens need 700–1,900 tokens, so 1.3 finishes them in 8–20 s. |
| The fallback order consumed the turn | Serial 30 s timeout → 1.2 parse → grounding (5–12 s) → up to three SAM plane queries. Two baseline turns hit the 60 s deadline and were sent offline. |
| SAM masks of large objects were shrunk | A live `remote control` mask arrives as a **281×1024 raster for a 345×1256 px bounds box**; a small LCD mask's raster equals its bounds (230×194). `maskToPolygon` added raster pixels directly to the bounds origin, so planes longer than 1024 px shrank about 0.82× toward their top-left and failed the 80% control-coverage check. The parser documents that the raster has its own size. |

## Repairs (failing-first tests)

1. `fix(gateway): scale SAM mask rasters to their source bounds`: scale raster coordinates by bounds/raster size. The regression failed first (59 px versus the expected 118 px).
2. `feat(gateway): hedge slow Spark 1.3 parses with Spark 1.2`: start 1.2 after **15 s** (guidance-spec §8, initial value); first valid parse wins, the loser is cancelled. An early 5xx or timeout still falls back at once; an early 4xx still fails without 1.2. Four of seven new tests failed first; the existing fallback tests are unchanged. The per-call bound, turn deadline and router chain are unchanged.

## Results (same 13 inputs)

| Configuration | Paid requests | Photo positives aligned | Turn deadline hit | Slowest photo final | Touch aligned | Negative |
|---|---:|---:|---:|---:|---:|---|
| Baseline (pulled `5c12331`) | 63 | 2/7 | 2 | 60.0 s | 4/5 | refused, no target |
| Hedge only | 63 | 2/7 | 0 | 49.3 s | 4/5 | refused, no target |
| Hedge + mask scaling | 62 | **4/7** | **0** | 51.6 s | 4/5 | refused, no target |

Final configuration per case: washer-01 41.1 s, washer-02 44.6 s, ac-01 48.2 s and ac-02 37.5 s are all aligned. tv-01, tv-02 and microwave-01 ask "I can't find the screen". microwave-02 refuses in 25.0 s. Touch: fastfood 8.8 s, cooktop 22.6 s, ticket 15.3 s and adversarial 17.5 s are aligned. Check-in ends after `layout` + a safety `say` (see below). Both remotes, which failed or flipped in the earlier runs, now succeed through the `remote control` plane, which is consistent with the scaling defect.

Hedge cost: in the final run 1.2 was started and then cancelled in 4 cases where 1.3 still won (ac-02, tv-02, microwave-02, adversarial). 1.3 was cancelled by a winning 1.2 in 1 case (washer-01); in 4 photo cases 1.3 still reached its 30 s bound while the hedged 1.2 was running, and 1.2 then answered 0–11 s later. Neither cancelled request's tokens reach the usage ledger, as before for timed-out calls.

Total paid image-model requests in this session: **274** (212 for the repairs above, 62 for the reasoning comparison) (3 batches of 62–63, plus 24 diagnostic probe calls). No ASR, Glimmer, phone or cloud call.

## Follow-up: parse reasoning effort (same day)

The Spark parse accepts `reasoning_effort`. The Day 1 low-effort trial (6/10) predates focused grounding and had no default baseline, so the same 13 inputs were rerun with `low` on the parse only (hedge and mask fix in place):

| Parse effort | Paid requests | Photo positives aligned | Touch aligned | Negative | Photo positive finals | Spark 1.3 photo parse |
|---|---:|---:|---:|---|---|---|
| model default | 62 | 4/7 | 4/5 | refused | 37.5–48.2 s | 25.5–30 s (4 timeouts) |
| `low` | 62 | **4/7** (same four) | **4/5** | refused | **30.6–34.9 s** | 17.5–22.5 s |

Adopted as the default (`SPARK_PARSE_REASONING=low`, guidance-spec §8, initial value); `default` restores the old request. Single run per configuration.

## Phone-side follow-ups (same day)

- Live reads were silent after "Looking at the screen." LOCATING now says "Still reading the screen…" every 10 s on live gateways (EN/HI/ES).
- No-screen and unclear-button asks now carry `ask.reason = "reframe"`; the phone re-frames and sends one fresh keyframe for the same goal instead of asking for the goal again (once per goal).

## Not fixed: recorded for decision

- **TV remotes and the Korean-label microwave** still cannot acquire a usable plane (both TV cases and microwave-01). TV/unknown classification and partial framing remain open from the earlier reports.
- **Guide-mode submit control:** Spark labels the check-in "Continue" as `submit`. Guide intent then sends only the safety `say` "I need you to confirm the amount first." The task stays open, so the phone waits for its LOCATING window. `guide-payment-policy.test.ts` pins `say` as the last message, so this was left unchanged; the amount wording is also misleading for a non-payment submit.
- **SAM `touchscreen display`** returned no mask on 5/5 composites (`screen`: 2/5). The composites' dark UI almost matches the bezel, so this is partly a test-image artifact; the phone's local quad hint covers acquisition in that case. No prompt change from this evidence.
- 1.3's output volume on photos (about 3k tokens for up to 60 elements) is the underlying latency driver. Reducing it means changing the verified parse prompt or schema, which needs its own review.

Earlier Day 1–7 acceptance gates remain open; nothing here substitutes for the phone check on a real flat touch panel.
