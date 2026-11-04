package io.github.fingerpost.guidance

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class ExpectedTotalTest {
    @Test fun localTerminalComparisonAndProtectedRoute() {
        val total=ExpectedTotal()
        total.expect("I expect 149 rupees")
        assertNull(total.warning(listOf("Total ₹149.00"),Strings.EN))
        assertTrue(total.warning(listOf("Total ₹1,490"),Strings.EN)!!.startsWith("Warning"))
        assertEquals(AmountOutput.EARPHONES,amountOutput(true))
        assertEquals(AmountOutput.NORMAL,amountOutput(false))
        total.clear();assertNull(total.warning(listOf("₹1490"),Strings.EN))
    }
    @Test fun selectedSumAndLocalizedExpectations() {
        val total=ExpectedTotal();total.selected("Small ₹99");total.selected("Drink ₹50")
        assertNull(total.warning(listOf("₹149"),Strings.HI))
        total.expect("मुझे १४९ रुपये की उम्मीद है")
        assertNotNull(total.warning(listOf("₹1490"),Strings.HI))
        total.expect("Espero 149 euros")
        assertNull(total.warning(listOf("€149"),Strings.ES))
        assertNotNull(total.warning(listOf("$149"),Strings.ES))
    }
}
