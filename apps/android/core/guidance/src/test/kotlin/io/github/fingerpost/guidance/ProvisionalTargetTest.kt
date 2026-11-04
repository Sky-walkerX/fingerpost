package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class ProvisionalTargetTest {
    private val boil = OcrToken("Boil",0.7,0.7,0.1,0.1)
    @Test fun onlyUniqueAllowlistedPrintedControlsAreProvisional() {
        assertEquals(boil,ProvisionalTarget.resolve("press boil",listOf(boil),true,false,false,false,"guide"))
        for (text in listOf("Pay","Confirm","Submit","Continue","123","Power","Total ₹149"))
            assertNull(ProvisionalTarget.resolve(text,listOf(boil.copy(text=text)),true,false,false,false,"guide"))
        assertNull(ProvisionalTarget.resolve("boil",listOf(boil,boil),true,false,false,false,"guide"))
        assertNull(ProvisionalTarget.resolve("boil",listOf(boil),false,false,false,false,"guide"))
        assertNull(ProvisionalTarget.resolve("boil",listOf(boil),true,true,false,false,"guide"))
        assertNull(ProvisionalTarget.resolve("boil",listOf(boil),true,false,true,false,"guide"))
        assertNull(ProvisionalTarget.resolve("boil",listOf(boil),true,false,false,true,"guide"))
        assertNull(ProvisionalTarget.resolve("boil",listOf(boil),true,false,false,false,"task"))
    }
    @Test fun localizedProvisionalAndCorrectionPhrases() {
        for (locale in listOf(Strings.EN,Strings.HI,Strings.ES)) {
            assertTrue(ProvisionalTarget.say(boil,locale).contains("Boil"))
            assertTrue(ProvisionalTarget.correction("Timer",locale).contains("Timer"))
        }
    }
    @Test fun cloudAskCancelsGuidanceInSameTickAndRetargetKeepsTone() {
        val m=GuidanceStateMachine()
        m.handle(GEvent.Start(0));m.handle(GEvent.GoalHeard(1,"boil"))
        val sent=m.handle(GEvent.Frame(2,true,false,null))
        assertTrue(sent.any { it is Effect.SendKeyframe })
        m.handle(GEvent.TargetArrived(2,"Checking","button"))
        assertEquals(GState.GUIDING,m.state)
        val correction=m.handle(GEvent.TargetCorrection(3,"Correction: Timer"))
        assertFalse(correction.contains(Effect.ToneOff))
        assertEquals(1,correction.filterIsInstance<Effect.Say>().size)
        m.handle(GEvent.CloudTurnPending(4))
        val ask=m.handle(GEvent.AskArrived(4,"ask","Which button?",emptyList()))
        assertEquals(GState.LISTENING,m.state)
        assertTrue(ask.contains(Effect.ToneOff))
    }
}
