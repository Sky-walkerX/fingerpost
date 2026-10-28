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

`infra/deploy-gateway.sh <project> <asia-south1|us-central1>` is prepared but has not been run against GCP. Install/authenticate the Cloud CLI and finish the documented project, billing, registry, secret and IAM setup first. The script requires a clean committed checkout. It uses the supported [Cloud Build config option](https://docs.cloud.google.com/sdk/gcloud/reference/builds/submit) with `infra/cloudbuild.yaml`; the explicit [source ignore file](https://docs.cloud.google.com/sdk/gcloud/reference/topic/gcloudignore) keeps private inputs out of uploads. This is the plan's temporary Day 1 deployment configuration; Day 3 must replace its unauthenticated session settings before authenticated deployment.

`pnpm --filter @fingerpost/gateway latency <asiaUrl> <usUrl> --n 20` requires `DEBUG_TOKEN`. It checks HTTP status/metric shape, disables redirects, bounds each request to 60 seconds and prints a comparison only after all regions finish. It reports health RTT, gateway Spark/SAM phases and actual fixed-box debug-request round trip. These fixed-box diagnostics alone cannot accept ADR-0003. The new `pnpm --filter @fingerpost/gateway latency:region <asiaUrl> <usUrl> --n 20` adds gateway ASR upgrade/accepted-handshake timings and actual binary upload-to-target receipt for the same approved rectified crop and privately configured exact `LATENCY_GOAL`. Configure the goal/token in ignored `.env`, source it locally, and never put either in a URL or report. Ranking requires two live candidates with 20 successful samples each; mock/short runs cannot choose a region. Live deployment/evidence and manual quality review remain pending; see [the tooling report](evals/day1-region-tooling.md).

Offline tooling checks make no cloud calls:

```sh
python3 -m unittest discover -s scripts -p 'test_*.py' -v
bash -n infra/deploy-gateway.sh
```
