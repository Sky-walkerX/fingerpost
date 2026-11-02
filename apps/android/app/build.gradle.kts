// First-build corrections are recorded in docs/progress.md.
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.kotlin.compose)   // AGP 9 has built-in Kotlin: do NOT add org.jetbrains.kotlin.android
}
// Firebase config is gitignored (download app/google-services.json from the Firebase console). Without it the
// app builds and runs unauthenticated against a mock/dev gateway.
if (file("google-services.json").exists()) apply(plugin = libs.plugins.google.services.get().pluginId)

android {
    namespace = "io.github.fingerpost"
    compileSdk = 37
    defaultConfig {
        applicationId = "io.github.fingerpost"
        minSdk = 29          // Android 10, required by the Meta Wearables DAT SDK later
        targetSdk = 36
        versionCode = providers.gradleProperty("fingerpost.versionCode").orNull?.let {
            requireNotNull(it.toIntOrNull()?.takeIf { code -> code > 0 }) { "fingerpost.versionCode must be positive" }
        } ?: 1
        versionName = providers.gradleProperty("fingerpost.versionName").orNull ?: "0.1.0"
        testInstrumentationRunner = "io.github.fingerpost.DeviceSafetyRunner"
        // ws://<laptop LAN IP>:8080 for local dev; the Cloud Run wss:// URL for releases. Set fingerpost.gatewayUrl in ~/.gradle/gradle.properties.
        buildConfigField("String", "GATEWAY_URL", "\"${providers.gradleProperty("fingerpost.gatewayUrl").orNull ?: "ws://10.0.2.2:8080"}\"")
    }
    val releaseStoreFile = providers.environmentVariable("RELEASE_STORE_FILE").orNull
    val releaseStorePassword = providers.environmentVariable("RELEASE_STORE_PASSWORD").orNull
    val releaseKeyAlias = providers.environmentVariable("RELEASE_KEY_ALIAS").orNull
    val releaseKeyPassword = providers.environmentVariable("RELEASE_KEY_PASSWORD").orNull
    val hasReleaseSigning = !releaseStoreFile.isNullOrBlank() &&
        !releaseStorePassword.isNullOrBlank() &&
        !releaseKeyAlias.isNullOrBlank() &&
        !releaseKeyPassword.isNullOrBlank()

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        debug {
            manifestPlaceholders["cleartext"] = "true" // a laptop gateway over ws://
            providers.gradleProperty("fingerpost.debugAbi").orNull?.let { abi ->
                require(abi in setOf("arm64-v8a", "armeabi-v7a", "x86", "x86_64")) { "Unsupported debug ABI" }
                ndk { abiFilters += abi }
            }
        }
        release {
            isMinifyEnabled = false
            manifestPlaceholders["cleartext"] = "false"
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
    androidResources { noCompress += "task" }   // MediaPipe memory-maps the model
    testOptions.unitTests.all { it.useJUnitPlatform() }
}

dependencies {
    implementation(project(":core:guidance"))
    implementation(project(":core:protocol"))
    implementation(libs.okhttp)
    implementation(libs.opencv)
    implementation(libs.mlkit.text.latin)
    implementation(libs.mlkit.text.devanagari)
    implementation(libs.mlkit.face)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)
    implementation(libs.kotlinx.coroutines.play.services)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.camerax.core)
    implementation(libs.camerax.camera2)
    implementation(libs.camerax.lifecycle)
    implementation(libs.camerax.view)
    implementation(libs.mediapipe.tasks.vision)
    implementation(libs.kotlinx.coroutines.android)
    testImplementation(platform(libs.junit.bom))
    testImplementation(libs.junit.jupiter)
    testRuntimeOnly(libs.junit.launcher)
}

// Release tasks must never silently produce an unsigned APK or point to the emulator.
gradle.taskGraph.whenReady {
    val releasePackagingTasks = setOf("assembleRelease", "bundleRelease", "packageRelease", "installRelease")
    if (allTasks.any { it.project == project && it.name in releasePackagingTasks }) {
        require(listOf("RELEASE_STORE_FILE", "RELEASE_STORE_PASSWORD", "RELEASE_KEY_ALIAS", "RELEASE_KEY_PASSWORD")
            .all { !providers.environmentVariable(it).orNull.isNullOrBlank() }) { "Release signing configuration is required" }
        val gateway = java.net.URI(providers.gradleProperty("fingerpost.gatewayUrl").orNull ?: "")
        require(gateway.scheme == "wss" && !gateway.host.isNullOrBlank() && gateway.rawUserInfo == null &&
            gateway.rawQuery == null && gateway.rawFragment == null && gateway.path.isNullOrEmpty()) {
            "Release requires fingerpost.gatewayUrl as a secure wss base URL without a path"
        }
        require(file("google-services.json").isFile) { "Release requires Firebase google-services.json" }
    }
}
