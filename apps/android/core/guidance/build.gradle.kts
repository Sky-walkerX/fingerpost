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
}
