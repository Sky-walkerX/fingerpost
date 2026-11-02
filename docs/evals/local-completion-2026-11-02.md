# Local completion checkpoint — November 2

Pulled `origin/main` at `9ce4a15`, advancing 66 commits from the initial checkout. Earlier work was preserved on `codex/local-completion-2026-11-02` and its named stash; overlapping implementations were not merged over teammates' current work. All new continuation commits are on `main`, with short subjects and no attribution trailers.

## Delivered

- C5-3: current README, architecture/tooling map, mock-stack commands and 30-minute device soak instructions. The soak itself remains pending.
- C6-1 preparation: working email/locale waitlist submission to the implemented API, with explicit server-confirmed success, retryable failure/rate-limit messages and a honeypot. The form stays disabled without an HTTPS `VITE_GATEWAY_URL`. Deployment and QR artwork remain pending.
- B6-3 preparation: source-based threat model and incident procedures for cloud pause, rollback, secret rotation, quotas and alert setup. Alerts are not configured or tested.
- C6-2 preparation: timed three-minute script and capture checklist. Footage, tester consent and final edit remain pending.

## Fresh verification

| Check | Result |
|---|---|
| Frozen dependency installation | Pass; pinned versions unchanged |
| Recursive TypeScript typecheck | Pass |
| Recursive tests | 616 pass: protocol 59, web 53, gateway 447, evals 57 |
| Recursive production build | Pass |
| Python tooling | 36 pass |
| Production dependency audit | No high/critical; 2 moderate transitive findings |
| Android SDK/device checks | Not run, assigned to teammates per user |

The audit reports minimatch GHSA-g3hv-75wg-m249 and glob GHSA-3g3m-2fjr-6pw4 through firebase-admin's dependency tree. No pinned dependency was changed to suppress an advisory.

## Remaining work

This is not a completed beta. Android source/acceptance tasks still need review, including low-vision UI, crash reporting/update checks and device phrasing; SDK-dependent checks belong to teammates. Human tester sessions, live model/real-photo quality gates, regional/cloud acceptance, hardware security review, Modal verification, production alerts, hosting, release signing/clean-phone installation and actual video capture remain open. Existing board entries marked doing/blocked retain their acceptance requirements.

Before opening the waitlist publicly, verify production persistence and deploy the page with the intended HTTPS gateway. A mock in-memory registration is not a public waitlist. No deployment, release tag, message to testers or paid model call was made in this pass.
