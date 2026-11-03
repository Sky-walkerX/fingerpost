package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class DonationSessionTest {
    private fun pose() = DonationPose(0, listOf(Vec2(0.0,0.0), Vec2(1.0,0.0), Vec2(1.0,1.0), Vec2(0.0,1.0)), Vec2(0.5,0.5))
    @Test fun consentNeverAcceptsMixedOrQualifiedAnswers() {
        for (text in listOf("yes no", "yes, no", "yes but", "maybe", "")) assertNull(donationConsent(text))
        for (text in listOf("Yes!", "हाँ", "sí")) assertEquals(true,donationConsent(text))
        assertEquals(false,donationConsent("no"))
    }
    @Test fun defaultAndPrivateTasksKeepNoPicturesAndCannotOffer() {
        val s = DonationSession()
        s.begin(false); val bytes=byteArrayOf(1); s.record(bytes, pose())
        assertArrayEquals(byteArrayOf(0), bytes); assertFalse(s.offer("failed")); assertNull(s.accept(true))
    }
    @Test fun uploadNeedsASpecificFailedTaskAndExplicitYes() {
        val s=DonationSession(); s.begin(true); s.record(byteArrayOf(1,2),pose())
        assertNull(s.accept(true)); assertFalse(s.offer("done")); assertTrue(s.offer("wrong"))
        assertTrue(s.awaitingConsent); val packet=s.accept(true)!!
        assertEquals("wrong",packet.outcome); assertEquals(1,packet.frames.size); assertTrue(s.uploadAllowed)
        assertNull(s.accept(true))
    }
    @Test fun unclearOrMissingAnswerIsNoAndErasesMemory() {
        for (answer in listOf<Boolean?>(false,null)) {
            val s=DonationSession(); s.begin(true); val bytes=byteArrayOf(1); s.record(bytes,pose()); s.offer("failed")
            assertNull(s.accept(answer)); assertFalse(s.uploadAllowed); assertArrayEquals(byteArrayOf(0),bytes)
            assertFalse(s.offer("failed"))
        }
    }
    @Test fun pinOrSensitiveModePermanentlyDisqualifiesThisTaskIncludingEarlierFrames() {
        val s=DonationSession(); s.begin(true); val bytes=byteArrayOf(1); s.record(bytes,pose()); s.protect()
        assertFalse(s.collecting); assertFalse(s.offer("nochange")); assertArrayEquals(byteArrayOf(0),bytes)
    }
    @Test fun cancellationInvalidatesGrantedPacketsAndLateCapturedFrames() {
        val s=DonationSession(); val ticket=s.begin(true); s.record(byteArrayOf(1),pose(),ticket); s.offer("failed")
        val packet=s.accept(true)!!; s.clear(); assertFalse(s.uploadAllowed)
        assertArrayEquals(byteArrayOf(0),packet.frames[0].jpeg)
        s.begin(true); val late=byteArrayOf(2); s.record(late,pose(),ticket)
        assertArrayEquals(byteArrayOf(0),late); assertFalse(s.offer("failed"))
    }
    @Test fun collectionIsBoundedAndOnlyNumericReplayIsAccepted() {
        val s=DonationSession(); s.begin(true); val first=byteArrayOf(1)
        s.record(first,pose()); repeat(20) { s.record(byteArrayOf(2),pose()) }
        assertArrayEquals(byteArrayOf(0),first); s.offer("failed"); assertEquals(20,s.accept(true)!!.frames.size)
        s.clear(); s.begin(true); val invalid=byteArrayOf(1)
        s.record(invalid,pose().copy(finger=Vec2(Double.NaN,0.0)))
        assertArrayEquals(byteArrayOf(0),invalid); assertFalse(s.offer("failed"))
    }
    @Test fun numericRedactionCoversSplitAndUnicodeCardDigitsWithoutKeepingText() {
        val tokens=listOf(OcrToken("1234",0.1,0.2,0.1,0.1),OcrToken("५६७८",0.3,0.2,0.1,0.1),
            OcrToken("9012-3456",0.5,0.2,0.2,0.1),OcrToken("Start",0.1,0.5,0.2,0.1))
        val boxes=donationNumberMasks(tokens)
        assertEquals(3,boxes.size); assertEquals(0.5,boxes[2].x)
    }
}
