# Capture checklist

Prepared shots; none recorded by this document. Lane C owns editing, lane A operates the device, lane B verifies numeric gateway evidence. Use generic device labels and consented participants. Record two clean takes per shot; keep private originals outside Git.

| Shot | Scene/device | Owner | Takes | Acceptance before use |
|---|---|---|---|---|
| Hook and press verification | Cooktop appliance + Android phone | A+C | 2 planned | Actual target/press/verify; no fabricated appliance response |
| Multi-step order | Tablet fastfood seed 1 + phone | A+C | 2 planned | Full order, amount confirm, no wrong pay tap |
| PIN boundary | Synthetic tablet pinpad + earphones | A+B+C | 2 planned | Before/during/after numeric uploads; no raw PIN or transcript |
| Architecture | Diagram and sanitized numeric dashboard | B+C | 2 planned | Correct model names and current measured revision |
| Private parsing | Synthetic screen + Modal metrics | B+C | 2 planned | Deployed Glimmer and private eval; otherwise explicitly pending |
| Explore and known screen | Tablet menu + phone | A+C | 2 planned | Audible summary and measured re-lock if speed is claimed |
| Hindi and Spanish | Synthetic cooktop/menu + phone | A+C | 2 planned | Actual voice installation and listen-through |
| Install and closing | Accessible web/install page | C | 2 planned | Links checked; APK claims only after accepted release |

For B-roll use synthetic simulator screens, hand/phone framing, earphones and the source/architecture view. Gateway captures must show only numerical counts and content-free status. Review every frame and audio track for private content before sharing. Track capture file, consent status, revision, duration and accepted take privately; mark missing footage BLOCKED in the edit handoff.

## Local synthetic take — November 2

Captured `video/out/sim-demo/simulator-fastfood.webm` and MP4 on this machine: 12.64 seconds, 1280×800, silent, home → menu → size → pay → PIN → done. Every frame carries “SIMULATOR ONLY · Synthetic B-roll · No phone or cloud session”. Chromium was already installed; external requests were blocked. The first fullscreen-sized take was rejected after inspection; the corrected take was decoded with ffprobe and its payment frame visually inspected. No real PIN digits were entered. This is simulator B-roll only, not a consented user trial, phone guidance, amount confirmation or no-upload safety demonstration.

Regenerate with the built app served on `http://127.0.0.1:4173` and `pnpm --filter @fingerpost/evals exec node --conditions=source scripts/capture-sim.ts`. The recorder refuses an existing take directory; move the previous take aside first. Generated footage stays ignored by Git. Real appliance/phone footage and the final edit remain pending.
