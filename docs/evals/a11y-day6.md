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
