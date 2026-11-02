# Day 4 coding repairs — 2026-11-02

Scope: the five user-requested coding repairs in A4-5, B4-1/B4-2 and A4-3. Earlier phase, real-device, live model, cloud and release gates remain open. No phone test, camera capture, paid API call or deployment was performed.

## Implemented

- Settings now apply ordinary and PIN speech rate, concise/normal/detailed guidance, preferred-hand tie-breaking (nearest valid hand still wins), chest-mount framing/timeout instructions and optional foreground volume-up repeat/volume-down local element lookup. Repeats are consumed once; PIN mode refuses hardware cues. No hardware cue requests an upload or opens the microphone.
- Last-output controls cannot turn the final speech/tone/haptics channel off. Persistence rejects invalid writes, legacy all-off values restore speech, and the engine also normalizes outputs. The camera session waits for saved settings, avoiding a normal-mode startup before a saved private preference loads.
- Private/sensitive task planning uses the existing local rules planner. The external Spark planner receives no protected screen, history or answer state. Once protected, planning stays local for the session. Only a newly parsed safe layout clears frame-routing sensitivity; new goals/abort cannot do it. First classification also protects subsequent mask refinement. Financial/identity routes refuse without Glimmer, including optional-router callers.
- PIN TTS uses an offline installed voice and synthesis without system playback; /dev/null discards the WAV. Transient PCM reaches a dedicated AudioTrack only after actual routing matches the selected earphones. Routing callbacks and bounded PCM writes check again, muting/flushing/closing on loss. Unknown routes, unsupported voices/formats and native errors fail closed. Generation checks reject stale synthesis after cancellation/replacement. No digit content is logged, persisted or sent through the shared speech/telemetry queue.
- Required build repairs: explicit Gradle URI/Locale imports avoid DSL shadowing; public activity key callbacks replace a restricted dispatch override; Compose LocalResources reads replace stale configuration-unaware resource access in settings/session UI. No version/dependency/schema changes or lint suppression.

## Test-first and preservation

Five gateway regressions reproduce planner/routing leaks before repair. Eight final privacy cases cover private tasks, financial/identity state, retained history, refinement, abort/new-goal lifetime, optional-router refusal and ordinary planning. New Android preference tests first stop on the expected missing APIs; PIN tests first stop on the missing playback gate and then reproduce a native-factory exception before error handling is added.

The old router test explicitly expecting a sensitive Meta fallback is corrected to the stricter refusal requested by the user and already specified by B4-1. Both payment replay harnesses explicitly inject a mock private port while retaining all flow assertions. The settings round-trip fixture now enables haptics instead of expecting an invalid all-off configuration; dedicated regressions assert invalid-save rejection and legacy recovery. No test is skipped or disabled.

## Local validation

| Check | Result |
|---|---|
| Workspace TS suites | 652 cases: protocol59, web53, gateway483, evals57; pass (full workspace run plus final gateway regressions) |
| `pnpm -r typecheck` / `pnpm -r build` | Pass |
| `pnpm check:day2` | Two synthetic loopback scenarios pass; zero external calls |
| Python tooling | All52 cases pass |
| `./scripts/android.sh :core:guidance:test :core:protocol:test :app:test :app:assembleDebug :app:assembleDebugAndroidTest :app:lintDebug --console=plain` | Pass; guidance278, protocol54, app32; zero failures/errors/skips |
| Android lint | Zero errors,16 warnings; no suppression/baseline added |

## Still required

A4-3/A4-5 remain blocked on real-phone acceptance. Verify TalkBack/large text, persisted settings, volume keys with TalkBack and foreground/background transitions, both hold modes and installed voices. Verify actual PIN speech through wired/USB/Bluetooth outputs, route switching/disconnection and no speaker fallback; inspect duplicated-route behavior on supported API levels. The playback unit tests exercise the gate with fake sinks, not actual Android audio routing. Older Android versions expose a single routed device; newer versions inspect the complete routed-device list. Validate real TTS callback/PCM behavior and the /dev/null synthesis path on the phone before accepting PIN help. These local checks do not establish physical privacy, tracking budgets, live Glimmer availability or overall Day 4 completion.
