# D2-T7 continuation and D2-T8 local evaluation — 2026-10-30

Owner: Codex. The user requested continuing T7 and the task after it. This report covers deployment preparation and independent local T8 verification; neither task is complete. No paid model call, cloud deployment, account/billing change or device acceptance was performed in this continuation.

## D2-T7

The implemented controller, Voice Transcribe relay and simulator integration were revalidated: 44 selected ASR/controller/auth/socket cases pass. The previous real Standard API/local authenticated exchange remains the Step 4 evidence; it was not repeated here.

The deployment script now accepts an optional `--with-sim` flag to bind the existing `sim-token` Secret Manager secret. Without it the live simulator route stays disabled; with it session authentication stays on. A person must create the secret and grant the service account access first. Two tests failed before the implementation; all seven stubbed deployment tests now pass, including dirty-tree rejection and unchanged default/auth behavior. `bash -n infra/deploy-gateway.sh` passes. No stubbed result proves a cloud deployment.

Step 5 remains blocked: `command -v gcloud` exits 1 with no output; no configured cloud project/candidate URLs or confirmed billing/Firebase/secrets readiness is available. ADR-0003 is still proposed. Firebase Spark does not support Cloud Run; linking Cloud Billing upgrades the project to Blaze, whose no-cost allowances do not guarantee zero charges. [Firebase requirements](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Cloud Run pricing](https://cloud.google.com/run/pricing).

## D2-T8 implementation and checks

The incoming repository already implements the specified metrics and `evaluateItem`; all six existing eval tests passed initially. They and the existing algorithms were preserved. Thirty additional cases now exercise the same parse → resolve → SAM/fallback path, public-report privacy, dataset containment, missing inputs/credentials, invalid CLI options and content-free provider errors. The initial expanded suite reproduced 25 failures; a later native-child probe also reproduced lost buffered output before the synchronous-output correction.

Changes:

- Validate CLI dataset/mode/positive integer limit/Markdown output arguments. Invalid options return 2 rather than quietly evaluating the wrong mode or an empty slice.
- Require a nonempty label file and ground-truth controls for its goals. Reject absolute/traversal/URL image references; preflight every image and its symlink destination before constructing the paid client.
- Export an import-safe `main` for testing; provider/filesystem errors return a fixed message and exit 1. Missing live credentials return 2 before dataset/model access. No exception payload or stack is printed.
- Replace source filenames with anonymous sample numbers in public reports. Recognized labels/goals and image data stay out of reports. No model prompt, scoring threshold or production request policy changed.
- Use synchronous writes for CLI status/error output. Minimal child-process probes on this laptop lost `console.error`/buffered writes but retained `writeSync(2, ...)`; the native CLI tests now assert both exact fixed errors and numeric stdout without weakening those checks.

Full validation:

```sh
pnpm --filter @fingerpost/gateway test asr controller e2e session-flow
pnpm --filter @fingerpost/evals test
pnpm -r test
pnpm -r typecheck
pnpm -r build
python3 -m unittest discover -s scripts -p 'test_*.py'
bash -n infra/deploy-gateway.sh
pnpm --filter @fingerpost/evals eval --set mock-panel --mode mock --out ../docs/evals/report-mock.md
```

Results: **363 TypeScript tests** (259 gateway, 48 protocol, 20 web, 36 evals), recursive typechecks/builds and **31 Python tooling tests** pass. Socket tests require loopback permission. Existing eval test files are unchanged. No dependency/version, protocol or Android source change was made; Android checks were not rerun locally.

The fresh [mock report](report-mock.md) has the required **50.0% target hit rate** across two synthetic fixture images, precision 40%, recall 80%, screen-type accuracy 50% and PIN/payment recall 0%. The mock always returns an appliance layout, so the PIN miss is intentional test coverage. These are fixture outcomes, not live quality results. Cost is an estimate from planning rates; mock execution spends nothing. Latency is parsing only; target hits include the same Spark-box fallback as the gateway.

## Remaining gates

T8 remains blocked on T7's deployment dependency and Steps 3/4. Ten public photos exist, but their private `evals/datasets/day1/labels.json` does not. A valid baseline needs independently reviewed boxes, exact labels, roles, screen types and 1–3 goals per image; model predictions must not be recycled as truth. The plan aims for 20 images, then 60 by Day 3. Real labels/photos stay ignored.

Live-baseline preflight command from the repository root (loads private credentials without printing/shell-expanding them, then uses the eval package's working directory):

```sh
node --conditions=source --input-type=module -e 'import {readFileSync} from "node:fs"; import {parseEnv} from "node:util"; import {main} from "./evals/src/run.ts"; const env=parseEnv(readFileSync(".env","utf8")); process.chdir("evals"); process.exitCode=await main(["--set","day1","--mode","live","--out","../docs/evals/report-day2-baseline.md"],env);'
```

Output (all available; exit 1):

```text
Evaluation failed. Check the local dataset and model availability.
```

No live baseline report was created and no paid client was constructed. The existing Day 1 diagnostic's 6/10 visual score is separate and is not substituted for the labeled baseline. The known default-policy Spark timeouts also remain unresolved; no request setting is adopted by this task.

Next: finish the human cloud prerequisites and measured ADR decision for T7; prepare/review the real ground truth, then run T8's labeled live baseline. No device/cloud/quality requirement or task dependency is marked fulfilled by these local checks.
