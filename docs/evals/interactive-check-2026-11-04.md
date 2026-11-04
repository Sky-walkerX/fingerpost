# Post-pull full check and interactive browser run (2026-11-04)

Local laptop, pulled `main` at `5c12331`, mock gateway (`MODEL_MODE=mock`) and Vite dev server. Browser checks used Playwright in a visible window. **Not tablet, phone, cloud or release acceptance.**

## Automated suites (pinned toolchain)

| Check | Result |
|---|---|
| `pnpm -r typecheck`, `pnpm -r build` | pass |
| `pnpm -r test` (pull) | 788 pass: protocol 67, web 53, gateway 602, evals 66 |
| `pnpm -r test` (after this session's fixes) | 797 pass: protocol 67, web 54, gateway 610, evals 66 |
| Python tooling | 80 pass |
| Android `:core:guidance:test :core:protocol:test :app:testDebugUnitTest :app:assembleDebug :app:lintDebug` (Homebrew JDK 21) | 407 JVM tests pass (307/58/42); debug APK built; lint 0 errors / 16 existing warnings |
| `pnpm check:day2` | 2 scenarios, endpointing, full-frame anchor, linked touch + verify; 0 external calls |
| `pnpm --filter @fingerpost/evals flows` against the plain mock gateway | 5/5 fail at step 5. The CLI needs a gateway serving the flows' scripted layouts; the same flows pass inside the evals vitest suite, which starts that gateway. No doc tells you to run the CLI against the generic mock, so this is a usability gap only. |

## Interactive browser run

| Surface | Interaction | Result |
|---|---|---|
| Simulator `fastfood` with `gw=` relay | home → Start order → Drinks → Medium → Pay by card → PIN pad | Correct screens; PIN pad scrambled; 4/4 touch relays `POST /v1/sim/events` → 200 |
| `cooktop`, `ticket`, `checkin`, `adversarial`, `pinpad` (phone, atm), `fastfood&glare=1` | First buttons on each | All render and advance; atm layout scrambled, phone layout ordered; adversarial icon-only button has an intentionally empty label; gateway logged 30 relayed sim events in total |
| Labeler `/label/` | Load a synthetic 1280×800 JPEG, drag a box, label/role/screen type, goal, Copy JSON | Valid item with normalized box; no upload request. The 4-byte `mock-panel` stub JPEGs are correctly refused as unreadable. |
| Landing, install, privacy, data-safety | axe-core (WCAG 2 A/AA, 2.1 AA, best practice) in the real browser | 0 violations each |
| Labeler | same axe run | `page-has-heading-one` (moderate). **Fixed** (`05cb6ef`), with a failing-first test; now 0 violations |
| Waitlist | Form | Disabled unless `VITE_GATEWAY_URL` is an `https://` gateway (by design). API checked directly: valid 200, repeat 200, bad email 400, filled spam-trap 400, CORS preflight 204 |
| Gateway | `/healthz`, `/v1/config` | `ok`/`fp.v1`; `minVersion 0.1.0`, `cloudEnabled true` |

Screenshots stay local under ignored `.playwright-mcp/ui/`; they show only synthetic simulator screens and public pages. The landing page still says "Beta target: November 2", which is now in the past; it was left unchanged because it's product copy.
