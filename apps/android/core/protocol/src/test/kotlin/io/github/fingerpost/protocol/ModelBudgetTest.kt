package io.github.fingerpost.protocol

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class ModelBudgetTest {
    @Test fun liveWaitIsRetainedAndLegacyReadyStillDecodes() {
        val message = parseServerMessage("""{"type":"ready","id":"synthetic","ts":0,"sessionId":"synthetic","quota":{"tasksLeft":1},"flags":{"cloudEnabled":true,"privateAvailable":false,"modelWaitMs":65000}}""") as ServerParse.Ok
        assertEquals(65_000L, (message.msg as Ready).flags.modelWaitMs)
        assertNull(Flags(true, false).modelWaitMs)
    }
    @Test fun invalidWaitCannotDisableClientTimeouts() {
        for (value in listOf(0L, 5999L, 65001L, Long.MAX_VALUE)) assertThrows<IllegalArgumentException> { Flags(true, false, value) }
    }
}
