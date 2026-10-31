# Local development

The repository pins its tool versions in `AGENTS.md`. Run commands from the repository root unless stated otherwise. A successful build does not replace device acceptance checks.

## Android on this laptop

The Android Studio installation is in `~/Downloads/android-studio-rabbit1-linux/android-studio`. Its bundled Java is version 25; Fingerpost uses a separate Temurin JDK 21 at `~/.local/share/fingerpost/jdk-21`.

The SDK is at `~/Android/Sdk`. Fingerpost needs SDK Platform 37 for the pinned Compose/Core libraries, Build Tools 36.0.0 and Platform Tools. The app retains minSdk 29 and targetSdk 36. Command-line tools are installed at `~/Android/Sdk/cmdline-tools/latest`. Platform 36 was also installed for the original plan; both platforms remain available.

Use the project launcher to select JDK 21 and the SDK without changing Java for other applications:

```sh
./scripts/android.sh :core:guidance:test --console=plain
./scripts/android.sh :app:assembleDebug --console=plain
./scripts/android.sh :app:installDebug
```

On another machine, set `FINGERPOST_JAVA_HOME` to its JDK 21 directory and `ANDROID_HOME` to its Android SDK directory. The launcher validates both before invoking the pinned Gradle wrapper.

In Android Studio, open `apps/android`. This laptop's ignored `.idea/gradle.xml` selects `GRADLE_LOCAL_JAVA_HOME`, and ignored `.gradle/config.properties` points it to JDK 21. Ignored `local.properties` selects `~/Android/Sdk`. On another machine, select its JDK 21 as the project's **Gradle JDK** and set its SDK location. Terminal builds use the launcher above. Local SDK/JDK paths and signing keys stay out of Git. See [Android's Gradle JDK documentation](https://developer.android.com/build/jdks).

For device checks, connect the phone with USB debugging enabled and check `~/Android/Sdk/platform-tools/adb devices -l`. Builds can run without a connected phone; camera, fingertip, TalkBack and latency acceptance require the actual device specified in the plan.

Before future Android acceptance testing, tell the user a connected phone is needed so they can attach it. Report JVM tests, browser/simulator checks, physical-phone transport with mock responses, and physical-phone recognition with live models separately. None substitutes for another. Retain only generic device labels and numeric/boolean evidence; do not export camera previews, microphone audio or recognized text into test reports.

For a physical phone over USB, `adb reverse tcp:8080 tcp:8080` forwards its localhost gateway port to the laptop. Build with `./scripts/android.sh :app:assembleDebug -Pfingerpost.gatewayUrl=ws://127.0.0.1:8080 --console=plain`, install the debug APK and bind the development gateway to laptop loopback. The default `10.0.2.2` URL is for an emulator. Keep production authentication unchanged; a cloud-free development run does not verify Firebase or attestation.

If Android refuses the universal debug APK for insufficient storage, add `-Pfingerpost.debugAbi=<abi>` using the connected phone's `ro.product.cpu.abi`. This optional debug-only filter packages just that architecture's native libraries; default and release packaging stay unchanged. It preserves phone files/app data. Supported values are `arm64-v8a`, `armeabi-v7a`, `x86` and `x86_64`.

The [physical-device safety regression](evals/day2-device-2026-10-31.md) uses Android's actual regex engine, which differs from the JDK. Build `:app:assembleDebugAndroidTest`, install its APK alongside the app, then run `adb -d shell am instrument -w io.github.fingerpost.test/io.github.fingerpost.DeviceSafetyRunner`. It needs no camera/network or additional dependency. CI compiles this APK; a physical device executes the checks.

For a debug app stuck on Connecting, ensure the local mock gateway is running and restore `adb reverse tcp:8080 tcp:8080` after reconnecting USB. Run `adb -d shell am instrument -w -e check session io.github.fingerpost.test/io.github.fingerpost.DeviceSafetyRunner` to verify the installed client's actual WebSocket/ready exchange without camera/microphone. This diagnostic accepts only `ws://127.0.0.1:8080`; it does not authenticate to Firebase or test live recognition. Reopen the app after instrumentation finishes, since instrumentation ends its target session.

## TypeScript on this laptop

Node 24 is available in the bundled runtime. Pinned pnpm 11.10.0 is installed persistently in `~/.local/share/fingerpost/node-tools`:

```sh
export PATH="$HOME/.local/share/fingerpost/node-tools/node_modules/.bin:$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node --version
pnpm --version
pnpm install
pnpm -r typecheck
pnpm -r test
```

Other machines can use their own Node 24 installation with pnpm 11.10.0. Full tests may remain red for planned skeletons; `docs/progress.md` records which tasks are implemented and which checks remain pending.

## Private gateway environment

The root [`.env.example`](../.env.example) contains offline defaults and commented placeholders for the settings currently implemented. Create your private copy from the repository root; `cp -n` preserves an existing `.env`:

```sh
cp -n .env.example .env
chmod 600 .env
```

Edit `.env` locally. Keep `MODEL_MODE=mock` for offline work. For live models, set `MODEL_MODE=live`, uncomment `META_API_KEY` and replace its placeholder with your actual Standard API key. Optional `DEBUG_TOKEN` and `SIM_TOKEN` should be separate private random values (for example, generate each locally with `openssl rand -hex 32`). `LATENCY_GOAL` is only needed by the regional measurement client. Leave unused settings commented; empty secret values fail configuration validation.

Gateway commands read the process environment; they do not automatically load the root `.env`. In the same terminal, load your private file before running them:

```sh
set -a
source .env
set +a
pnpm --filter @fingerpost/gateway dev
```

Only `.env.example` is committed. `.env` and `.env.*` are ignored. Cloud Run deployments obtain credentials from Secret Manager, with `meta-api-key` mapped to `META_API_KEY` and `debug-token` to `DEBUG_TOKEN`; never put provider credentials in the Android app.

### API key versus access token

Checked against Meta's [authentication guide](https://dev.meta.ai/docs/authentication), [API reference](https://dev.meta.ai/docs/api-reference), [Voice schemas](https://dev.meta.ai/docs/api-reference/voice/schemas), [speech guide](https://dev.meta.ai/docs/speech-to-text) and [Muse Code authentication](https://dev.meta.ai/docs/muse-code/auth) on 2026-10-30:

- Meta's API examples name the environment variable `MODEL_API_KEY`; Fingerpost deliberately reads `META_API_KEY`. Store the complete Model API credential there, not its dashboard name, numeric key id or only one part of the secret. Current authentication documentation shows `LLM_<numeric-id>_<secret>`; preserve the credential exactly as issued rather than changing separators to fit an example. Quote it in `.env` when loading through a shell.
- Spark/SAM HTTP requests use `Authorization: Bearer <full-key>`. The configured SDK adds the prefix; do not include `Bearer ` in the saved value.
- Voice Transcribe uses the **same key** in the first JSON frame: `authorization.accessToken = "Bearer <full-key>"`. Its HTTP Authorization header is ignored. The name `accessToken` does not introduce a second credential or an OAuth exchange. Both the application relay and regional probe already send this field.
- Muse Code's browser login is a separate CLI authentication option; the gateway uses direct Model API authentication. Do not copy browser session tokens or cookies into the app configuration.
- Fingerpost's Firebase ID token, attestation/session JWT and `SESSION_SECRET` secure the phone-to-gateway connection. They are separate from the Meta key. Newer live gateway configuration defaults to `AUTH_REQUIRED=true`, requiring `SESSION_SECRET` and `SIGNING_DIGESTS`, plus Firebase/cloud setup for the deployed server. The Meta key alone does not finish that setup; keep the auth protections enabled for production.

An offline transport check confirms that the pinned SDK builds the documented Bearer header and the ASR handshake includes the same credential under `authorization.accessToken`. No live request is required for this check. A 401 from the model-list endpoint establishes an authentication rejection, but does not alone identify whether the credential is incomplete, invalid, revoked or otherwise unusable; use the full credential from the Model API dashboard and never print it while troubleshooting.

## Cloud-free Day 2 verification

From the repository root, `pnpm check:day2` starts temporary loopback gateways and exercises the actual cooktop/ticket scene definitions through voice-message endpointing, full-frame geometry, linked simulator delivery, verify and abort. It injects deterministic model fixtures and does not load `.env` or contact Meta/GCP. CI runs it too. A pass proves protocol coordination; it is not camera recognition, real speech transcription, phone acceptance or a proxy trial.

For real-photo truth labeling, start `pnpm --filter @fingerpost/web dev` and open `http://localhost:5173/label/`. Select a local JPEG, draw each control box, enter the exact printed label and role, choose the screen type, then enter goals as `goal | label`. Copy JSON produces one evaluator item; combine reviewed items as `{"version":1,"items":[...]}` in ignored `evals/datasets/day1/labels.json`. Malformed goals or missing controls block export. The tool reads the file locally and sends no photo/label upload. Participant/camera captures must remain private.

See [current coding/acceptance evidence](evals/day2-local-completion-2026-10-31.md) and [cloud revalidation](evals/cloud-revalidation.md). GCP checks may be deferred; real-data, live-provider and device checks remain separate.

## Gateway containers on this laptop

Podman is installed. Its default container database still references an old home path, so Fingerpost uses a separate rootless store. This leaves existing containers untouched:

```sh
podman --root "$HOME/.local/share/fingerpost/containers" --runroot "/run/user/$(id -u)/fingerpost-containers" build --format docker -f services/gateway/Dockerfile -t localhost/fp-gateway .
podman --root "$HOME/.local/share/fingerpost/containers" --runroot "/run/user/$(id -u)/fingerpost-containers" run --rm -p 127.0.0.1:8080:8080 localhost/fp-gateway
```

In another terminal, `curl --fail http://localhost:8080/healthz` should report status `ok`, version `dev` and protocol `fp.v1`. This is a local mock-model check and makes no paid model calls.

## Day 1 live evaluation and deployment

Live evaluation is still blocked on the human setup in T0. Configure the ignored local environment privately; do not paste keys into chat or commit them. Put at least ten panel JPEGs in ignored `evals/datasets/day1/`, and a 1024×576 crop of at most 409,600 bytes in `evals/datasets/private/day1/latency-sample.jpg`. Leave the tracked synthetic latency placeholder unchanged. These header checks read dimensions; they do not fully decode or visually validate a photo.

`pnpm --filter @fingerpost/gateway smoke` makes paid model requests. It validates all input dimension headers before calling models, writes anonymous numeric results to `docs/evals/day1-smoke.md`, and keeps photo overlays in a unique local `evals/datasets/private/day1-smoke/<run>/` directory. Inspect those private overlays locally and record only the correctness count in the report. Do not infer the 8/10 quality result from polygon presence. Reported cost uses the plan's initial rates and is not a billing measurement.

`infra/deploy-gateway.sh <project> <asia-south1|us-central1> <signing-digests>` is prepared but has not been run against GCP. Install/authenticate the Cloud CLI and finish the documented project, billing, registry, secret and IAM setup first. The script requires a clean committed checkout. It uses the supported [Cloud Build config option](https://docs.cloud.google.com/sdk/gcloud/reference/builds/submit) with `infra/cloudbuild.yaml`; the explicit [source ignore file](https://docs.cloud.google.com/sdk/gcloud/reference/topic/gcloudignore) keeps private inputs out of uploads. It deploys with auth on (`AUTH_REQUIRED=true`). Before the first run, create the `session-secret` secret (`openssl rand -base64 48`), grant the Cloud Run service account **Cloud Datastore User** and **Firebase Authentication Viewer**, and pass the debug keystore's SHA-256 (from `keytool -list -v`, colons removed, lowercase) as `<signing-digests>`.

For D2-T7's protected simulator relay, append `--with-sim`. A human must first create `sim-token` in Secret Manager and grant the Cloud Run service account access. The flag maps `SIM_TOKEN=sim-token:latest`; it never accepts the actual token as a command argument. Without the flag the live relay stays disabled. Session authentication stays enabled in both cases.

Firebase's no-cost Spark plan does not support Cloud Run. Linking a Cloud Billing account upgrades the project to Blaze; no-cost allowances still apply, with charges possible beyond them. See [Firebase pricing-plan requirements](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) and [Cloud Run pricing](https://cloud.google.com/run/pricing). Account creation and billing are human-only tasks. Local mock development does not need a cloud project or billing account.

`pnpm --filter @fingerpost/gateway latency <asiaUrl> <usUrl> --n 20` requires `DEBUG_TOKEN`. It checks HTTP status/metric shape, disables redirects, bounds each request to 60 seconds and prints a comparison only after all regions finish. It reports health RTT, gateway Spark/SAM phases and actual fixed-box debug-request round trip. These fixed-box diagnostics alone cannot accept ADR-0003. The new `pnpm --filter @fingerpost/gateway latency:region <asiaUrl> <usUrl> --n 20` adds gateway ASR upgrade/accepted-handshake timings and actual binary upload-to-target receipt for the same approved rectified crop and privately configured exact `LATENCY_GOAL`. Configure the goal/token in ignored `.env`, source it locally, and never put either in a URL or report. Ranking requires two live candidates with 20 successful samples each; mock/short runs cannot choose a region. Live deployment/evidence and manual quality review remain pending; see [the tooling report](evals/day1-region-tooling.md).

Offline tooling checks make no cloud calls:

```sh
python3 -m unittest discover -s scripts -p 'test_*.py' -v
bash -n infra/deploy-gateway.sh
```
