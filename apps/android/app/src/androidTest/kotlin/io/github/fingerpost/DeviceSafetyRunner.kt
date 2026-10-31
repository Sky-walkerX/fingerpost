package io.github.fingerpost

import android.app.Activity
import android.app.Instrumentation
import android.os.Bundle
import io.github.fingerpost.guidance.OcrToken
import io.github.fingerpost.guidance.PinGate
import io.github.fingerpost.guidance.PinGateReason
import io.github.fingerpost.safety.UploadGuard

/** Runs the safety boundary on Android's regex engine, without a camera, network or test dependency. */
class DeviceSafetyRunner : Instrumentation() {
    private var checkKind: String? = null
    override fun onCreate(arguments: Bundle?) {
        super.onCreate(arguments)
        checkKind = arguments?.getString("check")
        start()
    }

    override fun onStart() {
        if (checkKind == "speech") { DeviceSpeechCheck.run(this); return }
        if (checkKind == "tracking") { DeviceTrackingCheck.run(this); return }
        if (checkKind == "session") { DeviceSessionCheck.run(this); return }
        var passed = 0
        val failures = mutableListOf<String>()
        fun check(name: String, test: () -> Unit) {
            try { test(); passed++ }
            catch (error: Throwable) { failures += "$name:${error.javaClass.simpleName}" }
        }
        fun tokens(text: String) = listOf(OcrToken(text, 0.2, 0.2, 0.3, 0.1))
        check("empty_ocr") { check(PinGate.check(emptyList()) == PinGateReason.NONE) }
        for ((name, text) in listOf("english" to "Enter PIN", "hindi" to "पिन दर्ज करें", "spanish" to "Introduzca su contraseña")) {
            check(name) { check(PinGate.check(tokens(text)) == PinGateReason.PIN_TEXT) }
        }
        check("word_boundaries") {
            for (text in listOf("Spinach", "Pinball", "पिनकोड", "clavecito", "pin_1", "pin\u0301"))
                check(PinGate.check(tokens(text)) == PinGateReason.NONE)
        }
        check("digit_grid") {
            val grid = (1..9).mapIndexed { i, n -> OcrToken("$n", 0.3 + i % 3 * 0.1, 0.2 + i / 3 * 0.15, 0.03, 0.06) }
            check(PinGate.check(grid) == PinGateReason.DIGIT_GRID)
        }
        check("first_frame_blocked") {
            var entered = 0
            val guard = UploadGuard({ entered++ }, {})
            check(!guard.mayUpload(tokens("Enter PIN"), 0))
            check(guard.pinMode && entered == 1)
            check(!guard.sendIfAllowed { error("Blocked upload reached the sender") })
        }
        check("failed_ocr_cannot_resume") {
            val guard = UploadGuard({}, {})
            guard.enterPinMode()
            guard.observe(emptyList(), 0)
            guard.observe(null, 1_000)
            guard.observe(emptyList(), 2_000)
            check(guard.pinMode)
            guard.observe(emptyList(), 4_000)
            check(!guard.pinMode)
        }
        val result = Bundle().apply {
            putInt("tests", passed + failures.size)
            putInt("passed", passed)
            putInt("failed", failures.size)
            putString("failures", failures.joinToString(","))
        }
        finish(if (failures.isEmpty()) Activity.RESULT_OK else Activity.RESULT_CANCELED, result)
    }
}
