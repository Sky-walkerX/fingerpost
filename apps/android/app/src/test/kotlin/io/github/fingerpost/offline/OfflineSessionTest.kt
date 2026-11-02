package io.github.fingerpost.offline

import io.github.fingerpost.guidance.Evidence
import io.github.fingerpost.guidance.Key
import io.github.fingerpost.guidance.OcrToken
import io.github.fingerpost.guidance.Strings
import io.github.fingerpost.guidance.Vec2
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

/** Days 4–7 plan, A6-1: basic mode turns a goal and the screen's OCR into a target polygon or a spoken reply. */
class OfflineSessionTest {
    private val session = OfflineSession()
    private val tokens = listOf(OcrToken("Start", 0.7, 0.8, 0.2, 0.1), OcrToken("Timer", 0.1, 0.8, 0.2, 0.1), OcrToken("7", 0.4, 0.4, 0.05, 0.05))

    @Test fun matchBecomesTheOcrBoxAsTarget() {
        val r = session.locate("press start", tokens, Strings.EN)
        assertEquals(OfflineLocate.Target(listOf(Vec2(0.7, 0.8), Vec2(0.7 + 0.2, 0.8), Vec2(0.7 + 0.2, 0.8 + 0.1), Vec2(0.7, 0.8 + 0.1)), "Found Start, bottom right."), r)
    }

    @Test fun iconGoalSaysTheCloudIsNeeded() {
        assertEquals(OfflineLocate.NotFound(Strings.get(Key.ICON_NEEDS_CLOUD, Strings.EN)), session.locate("wifi", tokens, Strings.EN))
    }

    @Test fun missListsWhatBasicModeCanRead() {
        assertEquals(OfflineLocate.NotFound("I can't find pay. I can see Start and Timer."), session.locate("press pay", tokens, Strings.EN))
    }

    @Test fun ambiguousAsksWhichOne() {
        val two = listOf(OcrToken("Start order", 0.1, 0.1, 0.2, 0.1), OcrToken("Start timer", 0.5, 0.1, 0.2, 0.1))
        assertEquals(OfflineLocate.NotFound("I see Start order and Start timer. Which one?"), session.locate("start", two, Strings.EN))
    }

    @Test fun verifyIsLocalAndWeakForDwell() {
        assertEquals(Strings.get(Key.DONE, Strings.HI), session.verifySay(Evidence.SCREEN_CHANGE, Strings.HI))
        assertEquals(Strings.get(Key.OFFLINE_DWELL_DONE, Strings.ES), session.verifySay(Evidence.DWELL, Strings.ES))
    }
}
