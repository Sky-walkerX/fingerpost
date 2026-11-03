package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class PinImageEvaluationTest {
    private fun sample(id: Int, pin: Boolean = true, sensitive: Boolean = true, server: Boolean? = null) =
        PinImageSample("sample-%06d".format(id), "a".repeat(64), "jpg", "sim", pin, sensitive, server)

    @Test fun failedOcrIsUnmeasuredRatherThanARecallPass() {
        val report = PinImageEvaluation.summarize(listOf(PinImageMeasurement(sample(1), null)))
        assertEquals(1, report.local.unknown)
        assertNull(report.local.recall)
        assertNull(report.combined.recall)
        assertEquals(0, report.local.detected)
    }
    @Test fun amountSummariesStaySeparateFromLocalPinGroundTruth() {
        val report = PinImageEvaluation.summarize(listOf(
            PinImageMeasurement(sample(1, server = false), true),
            PinImageMeasurement(sample(2, pin = false, server = true), false)))
        assertEquals(1, report.local.expected)
        assertEquals(2, report.server.expected)
        assertEquals(0.5, report.server.recall)
        assertEquals(1.0, report.combined.recall)
        assertEquals(0, report.local.falsePositives)
    }
    @Test fun unknownServerDoesNotHideMissesOrBecomeAMockPass() {
        val report = PinImageEvaluation.summarize(listOf(
            PinImageMeasurement(sample(1), true), PinImageMeasurement(sample(2), false)))
        assertNull(report.server.recall)
        assertNull(report.combined.recall)
        assertEquals(1, report.combined.detected)
        assertEquals(1, report.combined.unknown)
    }
    @Test fun negativesAndActualMissesAreCounted() {
        val report = PinImageEvaluation.summarize(listOf(
            PinImageMeasurement(sample(1, server = false), false),
            PinImageMeasurement(sample(2, pin = false, sensitive = false, server = false), true)))
        assertEquals(0.0, report.combined.recall)
        assertEquals(1, report.combined.missed)
        assertEquals(1, report.combined.falsePositives)
        assertEquals(2, report.simItems)
        assertEquals(0, report.realItems)
    }
    @Test fun identifiersHashesAndUniquenessAreValidatedBeforeFilesAreRead() {
        val good = sample(1)
        for (bad in listOf(good.copy(id = "../private"), good.copy(sha256 = "bad"), good.copy(format = "svg"),
            good.copy(origin = "maybe"), good.copy(expectedLocalBlock = true, expectedSensitive = false)))
            assertThrows(IllegalArgumentException::class.java) { PinImageEvaluation.validate(listOf(bad)) }
        assertThrows(IllegalArgumentException::class.java) { PinImageEvaluation.validate(listOf(good, good)) }
        assertThrows(IllegalArgumentException::class.java) { PinImageEvaluation.validate(emptyList()) }
    }
}
