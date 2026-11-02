plugins { alias(libs.plugins.kotlin.jvm) }

kotlin { jvmToolchain(21) }

dependencies {
    testImplementation(platform(libs.junit.bom))
    testImplementation(libs.junit.jupiter)
    testRuntimeOnly(libs.junit.launcher)
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
    // FlowReplayTest reads the shared flow scripts, like core:protocol's contract tests.
    systemProperty("fixtures.dir", rootDir.resolve("../../packages/protocol/fixtures").absolutePath)
    // PinGateDatasetTest (C4-4): synthetic pinpay sim items as OCR tokens; regenerate with
    // `pnpm --filter @fingerpost/evals export-pin-tokens`.
    systemProperty("pinpay.tokens", rootDir.resolve("../../evals/out/pinpay-tokens.json").absolutePath)
}
