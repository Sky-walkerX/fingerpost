// UNVERIFIED IN PLANNING (no Android SDK on the planning machine). The first agent to build it records any fix in docs/progress.md.
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)   // AGP 9 has built-in Kotlin: do NOT add org.jetbrains.kotlin.android
}

android {
    namespace = "io.github.fingerpost"
    compileSdk = 36
    defaultConfig {
        applicationId = "io.github.fingerpost"
        minSdk = 29          // Android 10, required by the Meta Wearables DAT SDK later
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }
    buildTypes { release { isMinifyEnabled = false } }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
    androidResources { noCompress += "task" }   // MediaPipe memory-maps the model
}

dependencies {
    implementation(project(":core:guidance"))
    implementation(libs.androidx.core.ktx)
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
}
