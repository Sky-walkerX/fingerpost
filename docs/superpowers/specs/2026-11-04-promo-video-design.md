# Promo video design (2026-11-04)

A 40–50 second motion promo for Fingerpost, built in code with Remotion. A separate three-minute pitch video follows later and is out of scope here (its draft script is `docs/video/script.md`).

## Intent

After one viewing, people remember three things (user's words):
1. **What Fingerpost is.**
2. **How it works:** the phone scans the display and guides the user's finger to the button.
3. **Privacy:** it stays out of payment and PIN screens; nothing is uploaded there.

The video opens with the problem in 3–5 seconds (user's requirement).

## Goals

- High frame rate and polished, beat-driven motion: 1920 × 1080 at **60 fps**, H.264 MP4.
- Style **D · Day and Night Cut** from the token page (https://claude.ai/artifact/6qxNRkKaeKqnWfzrwSM6Cf): the problem and privacy are told in navy, Fingerpost working is shown in white, and horizontal wipes switch between them on the beat.
- A **self-checkout kiosk** with the **phone above it scanning the display, in a 3D-like view** (user's requirement). Everything else is 2D.
- The 3D scan scene must look good in video, with **few borders** (user's words). Depth comes from light, shadow, glass and perspective, not outline strokes.
- Good background music, with the cuts timed to it.

## Non-goals

- The three-minute pitch video.
- Live footage, real people or a real phone screen recording.
- A vertical 1080 × 1920 cut (can follow later from the same scenes).

## Anti-goals (a failure even if it renders)

- Claims the app can't back up: no invented statistics, accuracy figures, user quotes or "available on Google Play".
- Any real retailer's brand, logo or look on the kiosk. The kiosk UI is fictional and unbranded.
- Phrases the app doesn't say. Spoken and captioned guidance uses the app's real wording from `Strings.kt` (directions such as "Move right." and "Up a little.", "Press now.", "Say yes to pay, or no to cancel.", "Done.", "PIN pad detected. I'll stay offline while you enter it."). The confirm summary before it is model-written in the app; the promo uses a plain example that includes the on-screen amount.
- Showing PIN digits being entered as data, or a real card number.
- Generic "AI promo" filler: lens flares, particle explosions, stock gradient blobs.

## Design tokens (style D)

| Token | Value |
|---|---|
| Day background | `#FFFFFF`, panels `#EFF4FC` |
| Night background | `#0D1830`, raised `#1B2C55` |
| Ink | `#0F1C35`; night text `#FFFFFF` and `#C9D4EA` |
| Accent | blue `#2F5FD6`; periwinkle `#A9C1FF` on navy |
| Highlight | peach `#FFB98F` (fingertip, target lock, PIN-mode chip) |
| Display type | Instrument Serif 170 px statements, italic for the second line of a pair |
| UI and caption type | Hanken Grotesk 600, 42 px captions, 28–32 px UI labels |
| Wipes | horizontal, easing `cubic-bezier(0.76, 0, 0.24, 1)`, 20 frames |
| Text entrances | rise 30 px over 14 frames, slight blur to sharp |
| Springs | Remotion `spring` with damping 18 (calm) or 12 (snappy, on beats) |

The tokens match the app and website palette (see `BrandThemeTest` and `apps/web/index.html`).

## Story (approved storyboard)

| # | Time (approx.) | Mode | What happens |
|---|---|---|---|
| 1 | 0–4 s | navy | **Problem.** A self-checkout screen that's only glass; a hand hovers, unsure where "Pay" is. "Flat glass. *No buttons to feel.*" |
| 2 | 4–7 s | wipe to white | **Answer.** "Fingerpost." lands on the beat, with one line: the phone finds the button for you. |
| 3 | 7–14 s | white, **3D** | **Scan.** A 3D kiosk; the phone floats above it at an angle, camera view live on its screen. Corner brackets lock onto the kiosk display; caption "Screen found." The camera eases in. |
| 4 | 14–20 s | white, 2D | **Ask and confirm.** The user says "Pay by card" (voice waveform and caption). Because it is a pay button, Fingerpost first reads the amount shown on the fictional screen and says "Say yes to pay, or no to cancel."; the user says "Yes." This is the app's real payment rule, so the promo must not skip it. |
| 5 | 20–29 s | white, 2D | **Guide.** Fingertip dot moves, rings close in, tone line rises: "Move right." → "Up a little." → "Press now." Buzz on target; the button presses, Fingerpost checks the screen changed and says "Done." |
| 6 | 29–38 s | navy | **Privacy.** A PIN pad appears: "PIN pad detected. I'll stay offline while you enter it." A chip reads "upload off · mic off"; upload lines visibly stop. |
| 7 | 38–46 s | white | **Close.** Voice, tone, vibration; English, हिन्दी, Español; free and open source; logo and fingerpost.web.app. |

Durations may stretch to fit the music within 40–50 s.

### Scene 3 craft notes (the user's emphasis)

- Kiosk: a freestanding self-checkout with a soft matte body (gradient lighting, no stroke), a recessed glass display with a faint reflection sweep, and a soft contact shadow on the floor.
- Kiosk display: fictional, unbranded checkout UI: basket list, total, and a large "Pay by card" button.
- Phone: thin dark bezel, rounded, angled above the kiosk. Its screen shows the camera view of the kiosk display, with peach corner brackets that lock on.
- Built with CSS 3D transforms (perspective, rotateX/Y, layered planes) inside Remotion. This is the builder's call: it renders deterministically in headless Chrome and avoids WebGL.

## Audio

- Background music (user's decision): an existing track under a licence that allows free use in videos without attribution, roughly 100–115 BPM (piano or soft intro into a driving beat). The user approves the track and its licence before it is used. The licence name and source URL are recorded next to the file in `apps/promo/public/music/LICENSE.md`.
- Guidance tones: synthesized beeps rising in pitch and rate as the finger closes in, matching the landing page's tone.
- No voice (user's decision). The app's lines appear as large captions, carried by the rising guidance tone and a visual buzz. The video must work with sound off.

## How it gets made

- A new workspace package `apps/promo` (Remotion 4, React 19), separate from the site and app.
- Pinned versions at least two weeks old: `remotion` and `@remotion/cli` 4.0.537, `react` and `react-dom` 19.1.10. Recorded under Deviations in `docs/progress.md`.
- Fonts come from the `@fontsource` packages the website already uses.
- Scenes are separate components on one `<Composition>` at 60 fps; a `Series` or explicit frame ranges place them.
- Rendering runs locally with `npx remotion render`; nothing is uploaded and no cloud rendering is used.
- Remotion's licence is free for individuals and companies of up to three people; a larger team needs a company licence.
- Checks: typecheck, a unit test that the composition is 60 fps, 1920 × 1080 and 40–50 s long, and a test that every on-screen phrase that quotes the app matches `Strings.kt`. Still frames from each scene are reviewed before the full render.

## Left to the builder

Exact frame timings within each beat, easing details, background motion such as faint grid drift, caption placement, and the final mix levels.

## Calls made by the author (check these)

- CSS 3D inside Remotion for the scan scene, not three.js/WebGL.
- A confirm-amount beat in scene 4 so the promo matches the app's payment rule.
- No voice: the user's "Pay by card" and "Yes" appear as captions with a waveform.
- 16:9 only for now; vertical later.
- A fictional amount on the fictional kiosk (for example "12.40"), with no currency symbol tied to a real brand.
