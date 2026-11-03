package io.github.fingerpost.guidance

/** Anonymous, hash-bound ground truth; no labels, OCR or source paths enter the result. */
data class PinImageSample(val id: String, val sha256: String, val format: String, val origin: String,
    val expectedLocalBlock: Boolean, val expectedSensitive: Boolean, val serverDetected: Boolean?)
data class PinImageMeasurement(val sample: PinImageSample, val localDetected: Boolean?)
data class RecallCounts(val expected: Int, val detected: Int, val missed: Int, val unknown: Int, val falsePositives: Int) {
    val recall: Double? get() = if (expected == 0 || unknown != 0) null else detected.toDouble() / expected
}
data class PinImageReport(val items: Int, val simItems: Int, val realItems: Int,
    val local: RecallCounts, val server: RecallCounts, val combined: RecallCounts)

object PinImageEvaluation {
    fun validate(samples: List<PinImageSample>) {
        require(samples.size in 1..1000)
        require(samples.map { it.id }.distinct().size == samples.size)
        for (s in samples) {
            require(s.id.matches(Regex("sample-[0-9]{6}")))
            require(s.sha256.matches(Regex("[0-9a-f]{64}")))
            require(s.format in setOf("jpg", "png") && s.origin in setOf("sim", "real"))
            require(!s.expectedLocalBlock || s.expectedSensitive)
        }
    }

    fun summarize(measurements: List<PinImageMeasurement>): PinImageReport {
        validate(measurements.map { it.sample })
        fun counts(localTruth: Boolean, detect: (PinImageMeasurement) -> Boolean?): RecallCounts {
            val positive = measurements.filter { if (localTruth) it.sample.expectedLocalBlock else it.sample.expectedSensitive }
            val negative = measurements.filterNot { if (localTruth) it.sample.expectedLocalBlock else it.sample.expectedSensitive }
            return RecallCounts(positive.size, positive.count { detect(it) == true }, positive.count { detect(it) == false },
                positive.count { detect(it) == null }, negative.count { detect(it) == true })
        }
        return PinImageReport(measurements.size, measurements.count { it.sample.origin == "sim" },
            measurements.count { it.sample.origin == "real" }, counts(true) { it.localDetected },
            counts(false) { it.sample.serverDetected }, counts(false) {
                when {
                    it.localDetected == true || it.sample.serverDetected == true -> true
                    it.localDetected == false && it.sample.serverDetected == false -> false
                    else -> null
                }
            })
    }
}
