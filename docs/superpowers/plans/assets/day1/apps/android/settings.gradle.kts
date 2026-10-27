pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = "fingerpost-android"
include(":core:guidance")
// The Android app module needs the Android SDK. Machines without it (CI lanes for pure logic, TS-only devs)
// can still run JVM tests because configure-on-demand skips configuring :app.
include(":app")
