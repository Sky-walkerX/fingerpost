#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export JAVA_HOME="${FINGERPOST_JAVA_HOME:-$HOME/.local/share/fingerpost/jdk-21}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

if [ ! -x "$JAVA_HOME/bin/javac" ]; then
    echo 'JDK 21 is required. Install it or set FINGERPOST_JAVA_HOME to its directory.' >&2
    exit 1
fi
java_version=$("$JAVA_HOME/bin/java" -XshowSettings:properties -version 2>&1 |
    awk '$1 == "java.specification.version" { print $3 }')
if [ "$java_version" != 21 ]; then
    echo "Fingerpost requires JDK 21; selected JDK is $java_version." >&2
    exit 1
fi
if [ ! -f "$ANDROID_HOME/platforms/android-36/android.jar" ]; then
    echo 'Android SDK Platform 36 is required. Check ANDROID_HOME and docs/local-development.md.' >&2
    exit 1
fi

cd "$repo_dir/apps/android"
exec ./gradlew "$@"
