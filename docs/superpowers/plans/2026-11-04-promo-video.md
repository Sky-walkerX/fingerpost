# Promo Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a 40–50 s, 1920 × 1080, 60 fps Fingerpost promo (style D, Day and Night Cut) as an H.264 MP4 from code.

**Architecture:** A new workspace package `apps/promo` holds one Remotion composition made of seven scene components placed on a beat-snapped timeline. Pure modules (`tokens`, `copy`, `timeline`) carry every number and string and are unit-tested; scenes only read them. A Python tool turns the music file into a committed `beats.json`, and a second one synthesises the guidance tones.

**Tech Stack:** Remotion 4.0.537 (`remotion`, `@remotion/cli`), React 19.1.10, TypeScript 7.0.2, vitest 5.0.5, `@fontsource/instrument-serif` 5.2.8 and `@fontsource-variable/hanken-grotesk` 5.2.8, Python 3 with numpy, plus ffmpeg (already installed).

**Spec:** `docs/superpowers/specs/2026-11-04-promo-video-design.md`

## Global Constraints

- Output: 1920 × 1080, **60 fps**, total **40–50 s**, H.264 MP4 with AAC audio, `yuv420p`.
- Pinned versions: `remotion` 4.0.537, `@remotion/cli` 4.0.537, `react` 19.1.10, `react-dom` 19.1.10, `@types/react` 19.3.0. Fonts: the same `@fontsource` versions as `apps/web`. Record the new dependencies under Deviations in `docs/progress.md`. If pnpm reports `ERR_PNPM_IGNORED_BUILDS`, follow AGENTS.md §6a.
- Colours and fonts come from `src/tokens.ts`, which must equal the web tokens in `apps/web/index.html` (`--fg`, `--accent`, `--panel`, `--muted`, `--peach`, `--night`, `--night-text`).
- Every line that quotes the app must match `apps/android/core/guidance/src/main/kotlin/io/github/fingerpost/guidance/Strings.kt` exactly: "Press now.", "Say yes to pay, or no to cancel.", "Done.", "PIN pad detected. I'll stay offline while you enter it.". Directions shown as captions are "Move right." and "Up a little.".
- No voice track. Captions are always burned in, and the video must read with sound off.
- Kiosk UI is fictional and unbranded. The example amount is `12.40`, with no currency symbol.
- No invented statistics, quotes or availability claims. No lens flares, particles or gradient blobs.
- Rendering is deterministic: no `Math.random`, `Date` or network in `src/`; use Remotion's `random(seed)` where variation is needed.
- Music: `public/music/upbeat-rock.mp3` (ikoliks_aj, "Upbeat - Upbeat Rock", Pixabay Content License), with `public/music/LICENSE.md` naming the source URL and licence.
- Commits follow Conventional Commits with **no AI attribution trailers**.

## Review Focus

- **Fonts not ready at capture.** A frame rendered before the fonts load would show Georgia or system sans. Expect every frame to use Instrument Serif and Hanken Grotesk. Pinned by Task 1's `delayRender` font gate plus the still-frame review in Task 3.
- **Music ends or loops wrongly.** The track is 1:39 and the video is under 50 s. Expect the music to start at the chosen offset and fade to silence over the last 1.5 s, never cutting off or looping. Pinned by the `musicVolume` test in Task 2.
- **Beat detection picks half or double tempo.** Expect the tempo clamped to 90–180 BPM and the beat grid snapped to it. Pinned by the synthetic click-track tests in Task 2.
- **A scene boundary drifts off the beat after a duration edit.** Expect every boundary to sit on a detected beat within 1 frame. Pinned by the `timeline` snapping test in Task 2.
- **Long captions overflow the frame.** "PIN pad detected. I'll stay offline while you enter it." at 42 px must wrap inside the safe area, 1680 px wide. Pinned by the `Caption` max-width rule and the Task 6 still review.

---

### Task 1: Package, tokens, copy and a renderable composition

**Files:**
- Create: `apps/promo/package.json`, `apps/promo/tsconfig.json`, `apps/promo/remotion.config.ts`, `apps/promo/src/index.ts`, `apps/promo/src/Root.tsx`, `apps/promo/src/Promo.tsx`, `apps/promo/src/tokens.ts`, `apps/promo/src/copy.ts`, `apps/promo/src/fonts.ts`
- Test: `apps/promo/test/tokens.test.ts`, `apps/promo/test/copy.test.ts`
- Modify: `docs/progress.md` (Deviations), `pnpm-lock.yaml`

**Interfaces:**
- Produces:
  - `tokens.ts`: `export const color = { day, panel, night, raised, ink, nightText, blue, periwinkle, peach }`, `export const font = { display: string; body: string }`, `export const ease = { wipe: [0.76, 0, 0.24, 1] }`, `export const springs = { calm: { damping: 18 }, snappy: { damping: 12 } }`, `export const FPS = 60, WIDTH = 1920, HEIGHT = 1080`.
  - `copy.ts`: `export const appQuote = { pressNow, sayYesToPay, done, pinPad }` (exact app strings), `export const directions = ['Move right.', 'Up a little.']`, plus the non-app lines `problem = ['Flat glass.', 'No buttons to feel.']`, `answer`, `userSays = { payByCard: 'Pay by card', yes: 'Yes.' }`, `confirmSummary = 'Pay by card, total 12.40.'`, `close = { channels: ['Voice', 'Tone', 'Vibration'], languages: ['English', 'हिन्दी', 'Español'], tag: 'Free and open source', url: 'fingerpost.web.app' }`.
  - `fonts.ts`: `export function useFontsReady(): void` (a `delayRender` gate until `document.fonts.ready`).
  - `Promo.tsx`: `export const Promo: React.FC` (Task 1 renders a placeholder; later tasks fill it in).

- [ ] **Step 1: Write the failing tests**
  - `tokens.test.ts` › `colours equal the website tokens`: read `../../web/index.html`, parse each `--name: #hex`, and assert `color.ink === --fg`, `color.blue === --accent`, `color.panel === --panel`, `color.peach === --peach`, `color.night === --night`, `color.nightText === --night-text` (case-insensitive). Also assert `FPS === 60`, `WIDTH === 1920` and `HEIGHT === 1080`.
  - `copy.test.ts` › `app quotes are the app's exact English strings`: read `Strings.kt` and, for keys `PRESS_NOW`, `SAY_YES_OR_NO`, `DONE`, `PIN_PAD_DETECTED`, take the first `Key.X to "…"` match and assert it equals `appQuote.pressNow`, `.sayYesToPay`, `.done` and `.pinPad` respectively.
  - `copy.test.ts` › `src has no nondeterminism`: read every file under `src/` and assert none contains `Math.random`, `Date.now`, `new Date` or `fetch(`.
- [ ] **Step 2: Run them to verify they fail**
  Run: `pnpm --filter @fingerpost/promo test`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement the package**
  - `package.json`: name `@fingerpost/promo`, `private`, `type: module`. Scripts: `studio: remotion studio src/index.ts`, `still: remotion still src/index.ts Promo`, `render: remotion render src/index.ts Promo out/promo.mp4`, `typecheck: tsc -p tsconfig.json --noEmit`, `test: vitest run`.
  - `remotion.config.ts`: codec `h264`, CRF 16, pixel format `yuv420p`, JPEG quality 95.
  - `Root.tsx` registers `<Composition id="Promo" fps={FPS} width={WIDTH} height={HEIGHT} durationInFrames={TOTAL_FRAMES}>`. Use a temporary `TOTAL_FRAMES = 45 * 60` until Task 2 supplies the timeline.
  - Add `out/` to `apps/promo/.gitignore`. Add the package to the workspace if `pnpm-workspace.yaml` does not already glob `apps/*`.
- [ ] **Step 4: Run tests and a still to verify**
  Run: `pnpm --filter @fingerpost/promo test && pnpm --filter @fingerpost/promo typecheck && pnpm --filter @fingerpost/promo still -- --frame=30 out/check.png`. Expected: tests PASS, typecheck clean, and a 1920 × 1080 PNG is written. Remotion may download Chrome Headless Shell the first time.
- [ ] **Step 5: Commit** `feat(promo): scaffold the Remotion promo package with brand tokens`

### Task 2: Music, beat grid and the timeline

**Files:**
- Create: `scripts/promo_beats.py`, `scripts/test_promo_beats.py`, `apps/promo/public/music/upbeat-rock.mp3` (from the user's download), `apps/promo/public/music/LICENSE.md`, `apps/promo/src/beats.json`, `apps/promo/src/timeline.ts`, `apps/promo/src/Music.tsx`
- Test: `apps/promo/test/timeline.test.ts`

**Interfaces:**
- Consumes: `FPS` from `tokens.ts`.
- Produces:
  - `beats.json`: `{ "bpm": number, "offsetSec": number, "beats": number[] }`. Beat times are in seconds from the music offset; the numbers are content-free.
  - `timeline.ts`: `export type SceneId = 'problem' | 'answer' | 'scan' | 'confirm' | 'guide' | 'privacy' | 'close'`; `export const scenes: { id: SceneId; from: number; duration: number }[]` (frames); `export const TOTAL_FRAMES: number`; `export function musicVolume(frame: number): number`.
  - `Music.tsx`: `export const Music: React.FC` (`<Audio src={staticFile('music/upbeat-rock.mp3')} startFrom={offsetSec * FPS} volume={musicVolume}>`).

- [ ] **Step 1: Write the failing tests**
  - `test_promo_beats.py` › `test_detects_tempo_of_click_track`: synthesise 20 s of clicks at 120 BPM with numpy, and assert `estimate(samples, sr)` returns a bpm within ±1 of 120.
  - `test_promo_beats.py` › `test_folds_half_and_double_tempo_into_range`: a 60 BPM click track returns a value in 90–180 (120). A 240 BPM track also returns 120.
  - `test_promo_beats.py` › `test_beats_are_evenly_spaced_from_first_onset`: the beat list starts within 20 ms of the first click and has a constant step of 60/bpm.
  - `timeline.test.ts` › `fits 40 to 50 seconds at 60 fps`: assert `TOTAL_FRAMES / 60` is ≥ 40 and ≤ 50, and that scenes are contiguous (each `from` equals the previous `from + duration`) in the spec order problem, answer, scan, confirm, guide, privacy, close.
  - `timeline.test.ts` › `problem is 3 to 5 seconds`: assert `scenes[0].duration` is within 180–300 frames.
  - `timeline.test.ts` › `every boundary sits on a beat`: for every scene start after the first, some beat × 60 lies within 1 frame of it.
  - `timeline.test.ts` › `music fades out and never stops early`: assert `musicVolume(0) > 0`, `musicVolume(TOTAL_FRAMES - 1) < 0.05`, monotone decrease over the last 90 frames, and `beats.json` covers `TOTAL_FRAMES / 60` seconds after `offsetSec`.
- [ ] **Step 2: Run them to verify they fail**
  Run: `python3 -m unittest scripts.test_promo_beats -v` and `pnpm --filter @fingerpost/promo test -- timeline`. Expected: FAIL (missing modules).
- [ ] **Step 3: Implement `scripts/promo_beats.py`**
  - CLI: `python3 scripts/promo_beats.py <mp3> <out.json> [--offset SEC]`. Decode with `ffmpeg -ac 1 -ar 22050 -f f32le`.
  - Algorithm: onset strength from half-wave-rectified spectral flux (2048-sample frames, hop 512). Pick the tempo as the autocorrelation peak over lags for 60–240 BPM, then fold into 90–180 by doubling or halving. Phase is the first onset; the beats form an even grid from there.
  - Choose `offsetSec` with the user while listening: the default is the first strong onset.
  - Copy the user's download to `public/music/upbeat-rock.mp3`. `LICENSE.md` names the title, artist, source URL `https://pixabay.com/music/rock-upbeat-upbeat-rock-628275/` and the "Pixabay Content License (https://pixabay.com/service/license-summary/)", downloaded 2026-11-04.
  - `timeline.ts`: target durations are problem 4 s, answer 3, scan 7, confirm 6, guide 9, privacy 9, close 8. Snap each boundary to the nearest beat. `musicVolume` is 0.9, ramping linearly to 0 over the last 90 frames.
- [ ] **Step 4: Run tests to verify they pass**
  Run the Step 2 commands, then `python3 -m unittest discover -s scripts -p 'test_*.py'`. Expected: all PASS, including the existing 80 Python tests.
- [ ] **Step 5: Commit** `feat(promo): beat-snapped timeline and licensed music`

### Task 3: Day/night wipe, captions, Problem and Answer scenes

**Files:**
- Create: `apps/promo/src/components/Wipe.tsx`, `apps/promo/src/components/Caption.tsx`, `apps/promo/src/components/Statement.tsx`, `apps/promo/src/scenes/Problem.tsx`, `apps/promo/src/scenes/Answer.tsx`
- Modify: `apps/promo/src/Promo.tsx`

**Interfaces:**
- Consumes: `color`, `font`, `ease`, `springs`; `copy.problem`, `copy.answer`; `scenes`.
- Produces:
  - `<Wipe progress={number} from="night" | "day" to="night" | "day">`: a full-frame horizontal clip-path wipe.
  - `<Caption text={string} tone="day" | "night" appear={number}>`: Hanken 600 42 px, max width 1680 px, centred 64 px above the bottom, entering with a 30 px rise over 14 frames.
  - `<Statement lines={string[]} italicSecond>`: Instrument Serif 170 px kinetic lines.

- [ ] **Step 1: Build Problem.** Navy frame; a flat glass panel with a hand silhouette hovering. Draw the hand as an SVG path in the night-text colour at 40% opacity: a simple illustrated hand, not a photo. Show "Flat glass." then *"No buttons to feel."*, each line on a beat.
- [ ] **Step 2: Build Answer.** A day wipe lands on the beat with "Fingerpost." in blue Instrument Serif. The brand mark (blue circle, white ring, peach dot) springs in at `springs.snappy`, with the answer line beneath.
- [ ] **Step 3: Wire them into `Promo.tsx`** with `<Sequence from={scene.from} durationInFrames={scene.duration}>` for each `scenes` entry. Later scenes stay as day or night placeholder fills.
- [ ] **Step 4: Verify stills.** Run `pnpm --filter @fingerpost/promo still -- --frame=<f> out/problem.png` at the problem's 25%, 75% and last frames, and at answer +12 frames. Expected: Instrument Serif and Hanken visibly rendered (not Georgia), no clipped text, wipe edge mid-transition. View each PNG.
- [ ] **Step 5: Commit** `feat(promo): problem and answer scenes with day/night wipes`

### Task 4: Kiosk screen and the 3D scan scene

**Files:**
- Create: `apps/promo/src/components/KioskScreen.tsx`, `apps/promo/src/components/Kiosk3D.tsx`, `apps/promo/src/components/Phone3D.tsx`, `apps/promo/src/scenes/Scan.tsx`
- Modify: `apps/promo/src/Promo.tsx`

**Interfaces:**
- Produces:
  - `<KioskScreen highlight?: 'pay' | null pressed?: boolean width={number}>`: the fictional checkout UI (basket of three generic items, total `12.40`, large "Pay by card" button). It is reused flat in Tasks 5–6.
  - `<Kiosk3D>`: CSS 3D.
  - `<Phone3D lock={0..1}>`: CSS 3D. `lock` drives the bracket lock-on.

- [ ] **Step 1: Build `KioskScreen`** in brand day colours. The total row reads "Total 12.40". The button label is "Pay by card".
- [ ] **Step 2: Build `Kiosk3D`.** A freestanding body made of layered planes inside `perspective: 2200px` and `transform-style: preserve-3d`:
  - matte body with vertical light gradient (`#e6ecf6` → `#c9d3e6`), no outline strokes;
  - recessed display holding `KioskScreen`, with a faint diagonal reflection sweep (white 8% → 0%) that moves over 2 s;
  - soft elliptical floor shadow (blur 40 px, navy 25%).
- [ ] **Step 3: Build `Phone3D`.** A thin dark bezel (`color.night`, radius 56 px), tilted about 20° over the kiosk. Its screen shows a perspective-cropped copy of `KioskScreen` as the camera view. Four peach corner brackets ease from 1.25× to 1× on `lock`.
- [ ] **Step 4: Build `Scan`.** The camera eases from a wide three-quarter view to a closer angle over the scene (rotateY −24° → −12°, rotateX 14° → 8°, scale 0.9 → 1.05). The phone floats in with `springs.calm`. Brackets lock on the beat at 55% of the scene. Caption: "Screen found." (`directions` style, not an app quote). Upload or scan lines are not shown here.
- [ ] **Step 5: Verify stills** at 10%, 55% and 90% of the scan scene. Expected: depth reads from light and shadow, with no hard outlines. The phone screen visibly mirrors the kiosk, and the brackets sit on the display. View each PNG and fix anything that looks flat or bordered.
- [ ] **Step 6: Commit** `feat(promo): 3D kiosk scan scene`

### Task 5: Confirm and Guide scenes with tones

**Files:**
- Create: `scripts/promo_tones.py`, `scripts/test_promo_tones.py`, `apps/promo/public/sfx/tone-1.wav` to `tone-4.wav`, `apps/promo/public/sfx/buzz.wav`, `apps/promo/src/components/Waveform.tsx`, `apps/promo/src/components/Rings.tsx`, `apps/promo/src/components/ToneLine.tsx`, `apps/promo/src/scenes/Confirm.tsx`, `apps/promo/src/scenes/Guide.tsx`
- Modify: `apps/promo/src/Promo.tsx`

**Interfaces:**
- Consumes: `KioskScreen`, `Caption`, `copy.userSays`, `copy.confirmSummary`, `appQuote.sayYesToPay`, `directions`, `appQuote.pressNow`, `appQuote.done`.
- Produces: `promo_tones.py` writes `tone-N.wav`: a beep train whose pitch is 330 + level × 560 Hz and whose gap is 0.42 − level × 0.26 s for levels 0.12, 0.4, 0.72 and 1.0 (the landing page's values), plus a 140 ms 60 Hz `buzz.wav`.

- [ ] **Step 1: Write the failing test** `test_promo_tones.py` › `test_pitch_rises_with_level`: generate levels 0.12 and 1.0, and assert the dominant FFT frequency rises from about 397 Hz to about 890 Hz (±5 Hz) and the files are 44.1 kHz mono 16-bit.
- [ ] **Step 2: Run it to verify it fails.** `python3 -m unittest scripts.test_promo_tones -v`. Expected: FAIL.
- [ ] **Step 3: Implement `promo_tones.py`** with the stdlib `wave` module and numpy. Run it to write the files into `apps/promo/public/sfx/`.
- [ ] **Step 4: Build `Confirm`.** Flat kiosk screen. "Pay by card" appears as a user caption with an animated `Waveform` (bars driven by a seeded `random`). Fingerpost's caption reads `confirmSummary` followed by `appQuote.sayYesToPay`, then the user says "Yes.". Align each caption to a beat.
- [ ] **Step 5: Build `Guide`.**
  - A peach fingertip dot moves on a spring path toward the "Pay by card" button.
  - `Rings` contract around the target.
  - `ToneLine` gains frequency through levels 0.12, 0.4, 0.72 and 1.0.
  - Captions: "Move right." → "Up a little." → `pressNow`.
  - On target, a visual buzz: a 6 px shake and peach pulse with `buzz.wav`. The button presses (scale 0.94, fill blue), then `done` appears.
  - Each `tone-N.wav` plays at its caption via `<Audio>` at volume 0.5.
- [ ] **Step 6: Verify.** Tests pass. Stills at each caption change show the dot, rings and the correct caption.
- [ ] **Step 7: Commit** `feat(promo): confirm and guide scenes with guidance tones`

### Task 6: Privacy and Close scenes

**Files:**
- Create: `apps/promo/src/scenes/Privacy.tsx`, `apps/promo/src/scenes/Close.tsx`
- Modify: `apps/promo/src/Promo.tsx`

**Interfaces:**
- Consumes: `appQuote.pinPad`, `copy.close`, `Wipe`, `Caption`, `Statement`, `color`.

- [ ] **Step 1: Build `Privacy`** (navy, entered by a wipe on the beat).
  - A card-terminal PIN pad springs in; its keys are blank, with no digits entered and no number shown.
  - Animated dotted "upload" lines from the phone toward a cloud glyph stop and fade on the beat.
  - A chip reads "PIN mode · upload off · mic off".
  - `appQuote.pinPad` appears as the caption, wrapping within 1680 px.
- [ ] **Step 2: Build `Close`** (wipe to day).
  - Three channel glyphs (voice bars, rising tone line, buzzing phone) with "Voice · Tone · Vibration".
  - The languages line, with `lang` attributes on the Hindi and Spanish spans.
  - "Free and open source", the brand mark and the "fingerpost.web.app" end card.
- [ ] **Step 3: Verify stills** at the privacy caption and the end card. The long caption must wrap inside the frame, Devanagari must render, and nothing may be clipped.
- [ ] **Step 4: Commit** `feat(promo): privacy and close scenes`

### Task 7: Full render, checks and handover

**Files:**
- Modify: `docs/progress.md` (Log), `apps/promo/README.md` (create: how to preview, render and replace the music)

- [ ] **Step 1: Render.** `pnpm --filter @fingerpost/promo render`. Expected: `apps/promo/out/promo.mp4`.
- [ ] **Step 2: Probe.** `ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate:format=duration -of json apps/promo/out/promo.mp4`. Expected: h264 1920 × 1080 at `60/1`, aac audio, and a duration between 40 and 50.
- [ ] **Step 3: Contact sheet.** `ffmpeg -i out/promo.mp4 -vf "fps=1,scale=480:-1,tile=6x8" -frames:v 1 out/sheet.png`. View it and check every scene reads correctly.
- [ ] **Step 4: Run all checks.** `pnpm -r typecheck && pnpm -r test && python3 -m unittest discover -s scripts -p 'test_*.py'`. Expected: all PASS.
- [ ] **Step 5: Log and commit** `docs(promo): record the promo render`. Keep the MP4 out of git (it stays in `out/`) and give the user its path.
