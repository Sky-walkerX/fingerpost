package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class SavedDevicesTest {
    private val tokens=listOf(OcrToken("Boil",0.1,0.1,0.2,0.1))
    private val layout=CachedLayout(listOf(CachedElement("b","Boil","button",ProvisionalTarget.polygon(tokens[0]))))
    @Test fun saveLookupRenameDeleteAndCodec() {
        val saved=SavedDevices()
        assertTrue(saved.save("kitchen",1L,layout,0,"appliance",false))
        assertNotNull(saved.find(1L,"boil",tokens,1,Strings.EN))
        assertTrue(saved.rename(1L,"hob"))
        assertEquals("hob",SavedDevicesCodec.decode(SavedDevicesCodec.encode(saved.list(1))).single().name)
        assertTrue(saved.delete(1L));assertTrue(saved.list(1).isEmpty())
    }
    @Test fun mismatchFallsBackAndDisagreementDropsSavedDevice() {
        val saved=SavedDevices();saved.save("hob",1L,layout,0,"appliance",false)
        assertNull(saved.find(65535L,"boil",tokens,1,Strings.EN))
        assertNull(saved.find(1L,"boil",listOf(tokens[0].copy(text="Fan")),1,Strings.EN))
        assertTrue(saved.list(1).isEmpty())
    }
    @Test fun refusesSensitiveScreensAndExpires() {
        val saved=SavedDevices()
        assertFalse(saved.save("pay",1,layout,0,"payment_entry",false))
        assertFalse(saved.save("private",1,layout,0,"appliance",true))
        assertFalse(saved.save("pay",1,CachedLayout(listOf(layout.elements[0].copy(role="pay"))),0,"appliance",false))
        saved.save("hob",1,layout,0,"appliance",false)
        assertTrue(saved.list(SavedDevices.maxAgeMs+1).isEmpty())
    }
}
