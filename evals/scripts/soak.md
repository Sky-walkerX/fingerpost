# Thirty-minute device soak

C5-3 preparation. **No device soak has been executed or passed by this document.** A teammate records the result after the full run. Use the current APK, the mock gateway and synthetic simulator screens; this requires no Meta key or paid call.

1. From the repository root run `pnpm --filter @fingerpost/gateway dev` with `MODEL_MODE=mock`. Start `pnpm --filter @fingerpost/web dev`. Keep the computer and test devices on the same trusted LAN. Use the configured simulator event endpoint and the same `run` value in the simulator URL and app session.
2. Install the locally built debug APK using the existing [Android workflow](../../docs/local-development.md). Configure its gateway to `ws://<laptop LAN IP>:8080`; open `http://<laptop LAN IP>:5173/sim/?scene=fastfood&seed=1&run=soak`. Confirm the gateway reports mock mode before starting. Use a synthetic test screen only.
3. Start a monotonic timer and record start time, Git commit, app version, generic phone/tablet labels, power/network conditions, initial thermal status and enabled TalkBack/locale. Never record serial numbers, actual PINs, camera images, voice, OCR text or transcripts. Collect only numeric metrics and content-free crash signatures.
4. Repeat guide → target reached → tap → verify through fastfood and ticket scenes. Include retries, back/cancel and a second goal after completion. Change the deterministic simulator seed between cycles. Count completed and failed tasks; do not treat a restart as continuing the same crash-free run.
5. Every five minutes record elapsed time, cycles, errors, reconnects, tracking FPS/latency and thermal status. During the run cover English/Hindi/Spanish, TalkBack focus, temporary hand loss, glare/reacquisition and one network disconnect/reconnect. Where a feature is unavailable, mark that scenario blocked rather than passed.
6. On the synthetic PIN screen confirm local PIN mode and no keyframe/audio upload while active, using numeric frame/audio counters or a content-free gateway request count. Never enter a real secret. Exit PIN mode and confirm guidance resumes; note any upload during PIN as a safety failure and stop the run.
7. At 30 continuous minutes finish the active task, background and reopen the app, then confirm no crash/ANR, no stuck speech/tone and a working next task. Stop the camera, microphone and mock services. A thermal slowdown or guidance failure is recorded even if the app remains crash-free.
8. Create `docs/evals/soak-day5.md` with the template below. Raw diagnostics remain private and must be reviewed for content before sharing. Crashes, ANRs, safety failures and incomplete duration prevent acceptance. Fix the cause and repeat the entire run.

```text
Commit/app version:
Generic device labels:
Start/end UTC; continuous elapsed seconds:
Mock mode confirmed:
Tasks attempted/completed; errors/reconnects:
Five-minute numeric checkpoints:
PIN upload checks (before/during/after; numeric counts only):
Crash/ANR count:
Locale/TalkBack/network/lifecycle scenarios:
Blocked scenarios and issue links:
Result: PASS / FAIL / BLOCKED
Operator and evidence review:
```

This checks device stability. It does not replace the required tracking budget, 50-session gateway load test, live model quality/latency, real-photo PIN recall, tester sessions or signed-release installation acceptance.
