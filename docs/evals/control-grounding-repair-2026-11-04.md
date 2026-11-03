# Control-surface and physical-button repair — 2026-11-04

## Outcome and limits

Implemented repairs for the two independently observed geometry failures: acquiring a whole appliance or its LCD instead of the control panel, and guiding to a printed caption instead of its associated button. Fresh real-provider checks now place the washing-machine and AC sample targets inside the manually identified buttons. These are gateway/still-image results, not physical-phone guidance, press or verification acceptance. The TV sample still asks without a usable plane; the broader photo/video quality and latency gates remain open.

The user authorized this repair and the live provider checks. After the requested pull restored a conflicting five-second policy, the user reaffirmed a **30-second default per call and 60-second total live turn**, then delegated implementation details. The client advertises a 65-second wait including transport margin. Strict integer 1000–60000 ms configuration validation, zero SDK retries, full-stream deadlines and cancellation remain enforced. This policy makes live recognition possible; it does not satisfy the original response-latency target.

## Implementation

- `screen-coordinates.ts` now encloses a convex SAM contour with four supporting edges, rather than choosing four inscribed vertices that cut rounded corners off the panel. Exact perspective corners are preserved. An extrapolated plane extending outside the captured image is refused rather than clamped into an inaccurate homography.
- On public appliance ports with the focused locator, an inadequate display plane is followed by bounded `control panel`, then `remote control` SAM queries. A qualifying semantic surface precedes a broad local contour or whole-appliance fallback. Existing control coverage and target-refinement checks remain in force. Remote tests are diagnostic stress cases; the locked flat-touchscreen MVP is unchanged.
- New `ground-control.v1` uses a contextual crop to distinguish the pressable body from its caption. The selected layout element and SAM seed both receive the corrected source-image box. Crop coordinates are mapped back before screen-plane projection. Grounding is not repeated for that element within the same frame.
- Crop preparation uses exact `sharp@0.35.5`, recorded under progress deviations. It bounds decoded pixels, validates JPEG/header dimensions, normalizes EXIF orientation, strips metadata, bounds the result and clears temporary bytes. Asynchronous native decoding keeps the gateway event loop available. No existing dependency pin, release-age exception, endpoint or store was added or changed.
- A turn/slide/not-found result or unavailable locator asks rather than restoring the original coarse target. If a full-frame appliance parse has no matching button, the pipeline asks directly instead of searching unrelated surfaces until the turn expires.
- The locator is an optional capability of the current routed model port. Private/Glimmer ports without it keep their existing geometry path; they never borrow the public Meta locator. Sensitive classification is recorded before acquisition can fail. Existing shared-memory trust, hashed storage, PIN gates and payment confirmation remain enforced.
- Earlier changes in this local repair are retained: conservative SAM refinement, bounded ASR keywords, duplicate-frame coalescing and compatible TS/Kotlin wait negotiation.

The new numerical acquisition/crop settings and enclosure algorithm are documented as initial values in guidance-spec §§2.0/4; existing turn/wait values remain in §8. The general screen-reading prompt was not replaced. A candidate whole-image locator still missed two controls and was rejected in favour of the measured crop approach.

## Test-first evidence

The rounded-surface and edge-control tests first reproduced two enclosure failures; a later clipped-contour case reproduced the missing out-of-frame rejection. Eight pipeline regressions failed before the initial integration, and a separate missing-button regression failed before its early-ask repair. Crop tests first failed on the absent module. Strict locator-output, geometry remapping, EXIF normalization, cancellation, private routing and unsupported-action tests now pass. Existing tests were not skipped or weakened.

After pulling the strict timeout policy, the 30-second SDK abort test failed against the incoming 5-second default before implementation. Tests now verify abort at the chosen bound, no early abort at 29 seconds, zero retries and rejection outside the configured limits. The incoming minimum-two-install memory test is retained.

## Actual provider evidence

Raw public media, model output, ASR content and overlays remain only in ignored local evaluation storage. This report records numeric outcomes and anonymous case identifiers. Independent manual button references were not supplied to the provider; crop prompts use the model's coarse element box.

### Focused probes

The cropped locator placed all three tested positive anchors inside the manually identified buttons, with per-call latencies 8.573, 10.614 and 8.708 seconds. A rotary negative returned `turn` with no box in 5.719 seconds. These probes informed implementation; they are not an unbiased corpus score or a full application-flow result. A partially visible microwave reference was corrected after manual review and the amendment retained; no emitted target or score changed as a result.

### First repaired list → speech → locate run

Four fresh real gateway sessions completed 33 image requests and four Voice Transcribe connections. All four intended synthetic-English command cores reached the goal path. No model response was reused.

| Case | Explore result | Spoken locate result | Independent geometry result |
|---|---|---|---|
| washer-02 | Summary in 23.279s; 5/5 reference controls in plane | Offline at 60.013s after both Spark parse versions timed out | Locator never ran; no target to score |
| ac-02 | Summary in 31.613s; 6/6 reference controls in plane | Target in 34.346s; focused locator 6.116s | Anchor inside actual button; production Kotlin replay puts its manual centre in ON |
| tv-02 | Ask in 34.306s | Ask in 25.954s | No usable plane; guide parse classified unknown; not repaired |
| microwave-02 | Summary in 33.091s | Offline at 60.029s | No requested button; no target. Unnecessary surface work motivated early-ask repair |

Both offline outcomes are retained as failures, not removed by a successful repeat. This run preceded the final missing-button optimization and the Git pull.

### Fresh post-pull initial speech → locate run

The final follow-up uses the application's initial flow: hello, synthetic spoken goal, real Voice Transcribe, goal acknowledgement, full JPEG, real Spark/SAM and protocol result. It does not perform an explore turn first. Two cases complete with seven image requests, two ASR connections and zero harness errors.

| Case | Final response | Time after keyframe | Independent result |
|---|---|---|---|
| washer-02 | Target | 37.518s | Anchor inside the actual button, 5/5 reference controls within the acquired panel; production Kotlin geometry replay places the manual button centre in ON |
| microwave-02, knob-only negative | Ask; no target | 23.342s | No matching discrete button. One initial display SAM call; no further panel searches or focused locator call |

Both spoken command cores were recognized. ASR times were 3.001 and 2.603 seconds. The washer's actual production locator took 7.293 seconds. Visual review of retained before/after overlays confirms that its former caption anchor is replaced by an anchor on the physical button. This narrowly verifies the original caption/surface defect on that sample; it is not a new whole-corpus success rate. The negative is a missing-button refusal, not a second semantic `turn` evaluation.

Evidence directories: ignored `evals/datasets/private/control-grounding-repair-2026-11-03/` contains crop/surface probes, `live/`, `post-pull-guide/`, numeric scores, production Kotlin geometry replay and annotated overlays. The date in that directory is the run's start date; final verification continued on November 4. The earlier [broader diagnostic](appliance-multimedia-check-2026-11-03.md) remains the baseline for unresolved photos and videos.

## Local validation after the pull

Pinned Node 24/pnpm 11.10.0 toolchain:

```bash
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm -r test --maxWorkers=2
pnpm -r build
python3 -m unittest discover -s scripts -p 'test_*.py'
./scripts/android.sh :core:guidance:test :core:protocol:test :app:testDebugUnitTest :app:assembleDebug --rerun-tasks --offline --no-daemon --console=plain
./scripts/android.sh :app:lintDebug --offline --no-daemon --console=plain
```

- Frozen install, all recursive typechecks and builds pass.
- **788 TypeScript tests pass:** 67 protocol, 53 web, 602 gateway, 66 evaluator.
- **80 Python tooling tests pass.** No diagnostic script connected to a phone.
- **407 Android JVM tests pass:** 307 guidance, 58 protocol, 42 app; zero failures/errors/skips. Debug APK build passes. Gradle reports 52/52 tasks executed in the forced rerun, not merely up-to-date results.
- Android lint passes with **zero errors and 16 existing warnings**.
- Dependency audit reports zero high/critical and two existing moderate transitive advisories. Existing pinned versions are unchanged; no release-age or install-script exception was introduced for Sharp.

Numeric validation logs remain ignored beside the provider evidence. No physical-phone, camera, Cloud Run deployment, signed build or tester acceptance ran during this repair.

## Git integration and next gate

The requested pull fast-forwarded main from `64f31c7` through six commits to `a573133`. A tracked patch/untracked-file backup and a recovery stash preserve the local repair. Both sides of progress history were retained. Incoming hash-only shared memory, the minimum-two-install trust floor, private configuration forwarding and local transport diagnostics are preserved. The later user-authorized timeout choice supersedes only the incoming five-second ceiling. Final diff/merge checks pass, with no staged files, secret matches or tracked private environment/media. No commit, push, deployment, private environment modification or credential publication was performed.

**Subsequent local commit request:** the user authorizes committing the verified implementation, synthetic tests and non-sensitive numerical reports after privacy review. Private environment files, raw public-media/model evidence, local backups and device identifiers are excluded. This records a local coding checkpoint; no push or acceptance gate is authorized by the commit itself.

Next actionable acceptance is a short real-phone check on a fully visible, non-sensitive flat touch panel, once the user reconnects and confirms readiness: verify panel lock, actual fingertip alignment, spoken goal, tone directions and physical press/verification. Separately, TV/unknown classification, partially framed controls, dim video frames, stochastic provider timeouts and recognition latency remain unresolved. Do not mark D1-T5, D2-T7, tracking performance, cloud or release gates complete from these results.
