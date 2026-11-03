package io.github.fingerpost

import android.app.Activity
import android.app.Instrumentation
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import io.github.fingerpost.guidance.PinGate
import io.github.fingerpost.guidance.PinGateReason
import io.github.fingerpost.guidance.PinImageEvaluation
import io.github.fingerpost.guidance.PinImageMeasurement
import io.github.fingerpost.guidance.PinImageSample
import io.github.fingerpost.guidance.RecallCounts
import io.github.fingerpost.vision.Ocr
import java.io.File
import java.security.MessageDigest
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*

/** Private local images → production OCR/PIN gate. No camera, session client or model adapter. */
internal object DevicePinImageCheck {
    @Serializable private data class Corpus(val version: Int, val items: List<Sample>)
    @Serializable private data class Sample(val id: String, val sha256: String, val format: String, val origin: String,
        val expectedLocalBlock: Boolean, val expectedSensitive: Boolean, val serverDetected: Boolean?) {
        fun value() = PinImageSample(id, sha256, format, origin, expectedLocalBlock, expectedSensitive, serverDetected)
    }

    fun run(instrumentation: Instrumentation) {
        val result = Bundle()
        try {
            val root = File(requireNotNull(instrumentation.targetContext.getExternalFilesDir(null)), "pin-eval").canonicalFile
            val resultFile = File(root, "result.json")
            require(resultFile.canonicalFile.parentFile == root)
            if (resultFile.exists()) require(resultFile.delete()) // A failed run must not leave a stale score.
            val manifest = File(root, "manifest.json")
            require(manifest.canonicalFile.parentFile == root && manifest.length() in 1..1_048_576)
            val corpus = Json.decodeFromString<Corpus>(manifest.readText())
            require(corpus.version == 1)
            val samples = corpus.items.map { it.value() }
            PinImageEvaluation.validate(samples)
            // Validate every path/size/hash before any OCR. A mismatch is never scored as a negative.
            fun bytes(s: PinImageSample): ByteArray {
                val file = File(root, "${s.id}.${s.format}")
                require(file.canonicalFile.parentFile == root && file.length() in 1..8_388_608)
                return file.readBytes().also { data ->
                    require(MessageDigest.getInstance("SHA-256").digest(data).joinToString("") { "%02x".format(it) } == s.sha256)
                }
            }
            for (s in samples) bytes(s)
            val ocr = Ocr()
            val measurements = try {
                samples.map { s ->
                    var bitmap: Bitmap? = null
                    var scaled: Bitmap? = null
                    val detected = try {
                        val data = bytes(s)
                        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                        BitmapFactory.decodeByteArray(data, 0, data.size, bounds)
                        require(bounds.outWidth in 1..8192 && bounds.outHeight in 1..8192 &&
                            bounds.outWidth.toLong() * bounds.outHeight <= 32_000_000)
                        val decode = BitmapFactory.Options().apply {
                            while (bounds.outWidth / inSampleSize.coerceAtLeast(1) > 2048 ||
                                bounds.outHeight / inSampleSize.coerceAtLeast(1) > 4096)
                                inSampleSize = inSampleSize.coerceAtLeast(1) * 2
                        }
                        bitmap = requireNotNull(BitmapFactory.decodeByteArray(data, 0, data.size, decode))
                        // FrameRouter's pre-upload OCR space is upright, 1024 pixels wide.
                        val height = (bitmap.height * (1024.0 / bitmap.width)).toInt().coerceAtLeast(1)
                        require(height <= 8192)
                        scaled = Bitmap.createScaledBitmap(bitmap, 1024, height, true)
                        ocr.recognize(scaled)?.let { tokens ->
                            PinGate.check(tokens, 1024.0 / height) != PinGateReason.NONE
                        }
                    } catch (_: Exception) { null }
                    finally { if (scaled !== bitmap) scaled?.recycle(); bitmap?.recycle() }
                    PinImageMeasurement(s, detected)
                }
            } finally { ocr.close() }
            val summary = PinImageEvaluation.summarize(measurements)
            fun counts(c: RecallCounts) = buildJsonObject {
                put("expected", c.expected); put("detected", c.detected); put("missed", c.missed)
                put("unknown", c.unknown); put("falsePositives", c.falsePositives)
                put("recall", c.recall?.let(::JsonPrimitive) ?: JsonNull)
            }
            val output = buildJsonObject {
                put("version", 1); put("items", summary.items); put("simItems", summary.simItems); put("realItems", summary.realItems)
                put("local", counts(summary.local)); put("server", counts(summary.server)); put("combined", counts(summary.combined))
                put("measurements", buildJsonArray { for (m in measurements) add(buildJsonObject {
                    put("id", m.sample.id); put("sha256", m.sample.sha256)
                    put("localDetected", m.localDetected?.let(::JsonPrimitive) ?: JsonNull)
                }) })
            }
            resultFile.writeText(output.toString() + "\n")
            val failures = measurements.count { it.localDetected == null }
            result.putInt("images", summary.items); result.putInt("ocrFailures", failures)
            result.putString("status", if (failures == 0) "MEASURED" else "INCOMPLETE")
            instrumentation.finish(if (failures == 0) Activity.RESULT_OK else Activity.RESULT_CANCELED, result)
        } catch (_: Exception) {
            result.putString("status", "INVALID_DATASET")
            instrumentation.finish(Activity.RESULT_CANCELED, result)
        }
    }
}
