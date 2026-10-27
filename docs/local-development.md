# Local development

The repository pins its tool versions in `AGENTS.md`. Run commands from the repository root unless stated otherwise. A successful build does not replace device acceptance checks.

## Android on this laptop

The Android Studio installation is in `~/Downloads/android-studio-rabbit1-linux/android-studio`. Its bundled Java is version 25; Fingerpost uses a separate Temurin JDK 21 at `~/.local/share/fingerpost/jdk-21`.

The SDK is at `~/Android/Sdk`. Fingerpost needs SDK Platform 36, Build Tools 36.0.0 and Platform Tools. Command-line tools are installed at `~/Android/Sdk/cmdline-tools/latest`. Platform 37 can remain installed alongside 36.

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
