package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class ReplayTimelineTest {
    @Test fun loopsVideoWithoutRewindingInferenceTimestamps() {
        var now = 1000L
        val timeline = ReplayTimeline(100, 25.0) { now }
        timeline.start()
        assertEquals(ReplayTick(0, 1000), timeline.next())
        now += 40; assertEquals(ReplayTick(40_000, 1040), timeline.next())
        now += 80; assertEquals(ReplayTick(20_000, 1120), timeline.next())
    }
    @Test fun pauseDropsFramesAndRestartDoesNotReplayTheBackgroundGap() {
        var now = 10L
        val timeline = ReplayTimeline(500, 25.0) { now }
        timeline.start(); timeline.next(); timeline.stop(); now += 10_000
        assertNull(timeline.next()); timeline.start()
        assertEquals(ReplayTick(0, now), timeline.next())
    }
    @Test fun slowDecodeDropsBacklogAndDuplicateTicksAreNotSubmitted() {
        var now = 0L
        val timeline = ReplayTimeline(1000, 25.0) { now }
        timeline.start(); assertNotNull(timeline.next()); assertNull(timeline.next())
        now = 240; assertEquals(ReplayTick(240_000, 240), timeline.next()); assertNull(timeline.next())
    }
    @Test fun invalidMediaMetadataCannotCreateAnUnboundedScheduler() {
        for (fps in listOf(0.0, Double.NaN, Double.POSITIVE_INFINITY, 61.0))
            assertThrows(IllegalArgumentException::class.java) { ReplayTimeline(100, fps) { 0 } }
        assertThrows(IllegalArgumentException::class.java) { ReplayTimeline(0, 30.0) { 0 } }
    }
}
