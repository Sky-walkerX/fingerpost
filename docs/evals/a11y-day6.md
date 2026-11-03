# Day 6 physical accessibility acceptance

Status: **NOT_RUN**. Android JVM tests, debug builds and lint pass; none of those establishes the following physical checks. Ask the user to attach a phone before device execution. Record only a generic device label, tested revision, locale, font scale, outcome and issue reference; retain no screenshots, recognized content or personal identifiers here.

| Surface/check | Method | Outcome |
|---|---|---|
| Camera permission denial, settings return | TalkBack order, spoken instruction and recovery | NOT_RUN |
| Onboarding/tutorial | TalkBack actions, focus order and completion | NOT_RUN |
| Session preview and target/fingertip overlay | Contrast/6dp outlines, portrait/landscape and 200% font | NOT_RUN |
| Session actions/status | One intended session element, descriptive actions and state changes | NOT_RUN |
| Settings | TalkBack labels/order, last-output guard, saved preferences and 200% text | NOT_RUN |
| Hardware keys and hold modes | Foreground controls with TalkBack, rotation and background return | NOT_RUN |
| Offline basic mode | Installed/missing local ASR/TTS, permission handling, no-network behavior and reconnection | NOT_RUN |
| English/Hindi/Spanish | Every-string listen-through, installed/missing voice fallback and speech rate | NOT_RUN |
| Payment/PIN | Confirm actions, local speech on actual earphone route, disconnect/route switching, no upload | NOT_RUN |
| Every screen | Accessibility Scanner and manual TalkBack pass, linked findings | NOT_RUN |

Acceptance requires actual operator results and issue resolution. Do not replace NOT_RUN with PASS from unit tests, browser simulation or a source review.

## 2026-11-03 synthetic PIN observation

Generic USB phone; locale and font scale not recorded. With a local synthetic calculator keypad and earphones, PIN mode entered and digit-under-finger speech was heard intermittently. The fingertip/rectangle lock repeatedly disappeared or did not settle, so further digit announcements were missed. No real PIN, payment, media, transcript, OCR text, or digit values were retained. **PARTIAL / not accepted:** repeat only after stable fingertip and screen lock; earphone-route loss and no-upload checks remain untested.

## 2026-11-04 controlled synthetic-keypad follow-up

Workspace revision `e0b5cfb`; the installed package reported version `0.1.0` (no APK provenance claim). A 15-second GPU/two-hand numeric capture stayed awake; thermal status rose from 1 to 2. Camera delivery ranged 14.45–30.69 FPS, tracker output 5–12 FPS, sampled inference 36–97 ms (median 48 ms; rolling maximum 112 ms), and observed hand counts were 0 or 1. This confirms intermittent hand detection and slow inference, not a thermal-only event. During the synthetic PIN trial, the green tracking rectangle drifted away from the keypad and returned to yellow candidate state. Earphone-loss warning worked. While PIN was active, a read-only Android audio-service snapshot reported no active recording clients; after the keypad disappeared, the operator confirmed normal-mode recovery. The installed camera-free safety runner passed 8/8, including first-frame blocking and failed-OCR fail-closed checks. **Still NOT RUN:** physical packet-level no-upload observation, stable-lock/digit repeat, and earphone-route timing/disconnect evidence. No real PIN, payment, media, transcript, OCR text, or digit values were retained.

On the immediate repeat with the same synthetic keypad, the operator observed a green tracking rectangle and heard the digit-under-finger through PIN help. This is a successful single observation, not a stable-lock acceptance result: the preceding run drifted/lost lock and numeric performance remained outside the tracking budget.
