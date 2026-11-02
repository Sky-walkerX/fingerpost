package io.github.fingerpost.updates

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class ReleaseVersionTest {
    @Test fun comparesNumbersRatherThanText() {
        assertTrue(ReleaseVersion.isNewer("v0.10.0", "0.9.9"))
        assertFalse(ReleaseVersion.isNewer("v0.9.9", "0.10.0"))
    }
    @Test fun stableReleaseSucceedsItsPrerelease() {
        assertTrue(ReleaseVersion.isNewer("v1.0.0", "1.0.0-rc1"))
        assertFalse(ReleaseVersion.isNewer("v1.0.0-rc1", "1.0.0"))
    }
    @Test fun ignoresMalformedEqualAndPrereleaseTags() {
        for (tag in listOf("latest", "v1.0", "v1.0.0-rc2", "v1.0.0", "v999999999999.0.0"))
            assertFalse(ReleaseVersion.isNewer(tag, "1.0.0"))
        assertFalse(ReleaseVersion.isNewer("v2.0.0", "unknown"))
    }
}
