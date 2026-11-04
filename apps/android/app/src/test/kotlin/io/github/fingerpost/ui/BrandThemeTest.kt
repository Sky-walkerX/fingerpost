package io.github.fingerpost.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.toArgb
import io.github.fingerpost.settings.Appearance
import java.io.File
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class BrandThemeTest {
    private fun ratio(a: Color, b: Color): Double {
        val (hi, lo) = listOf(a.luminance(), b.luminance()).sortedDescending()
        return (hi + 0.05) / (lo + 0.05)
    }
    private fun assertContrast(min: Double, fg: Color, bg: Color, what: String) =
        assertTrue(ratio(fg, bg) >= min, "$what: ${"%.2f".format(ratio(fg, bg))}:1 < $min:1")

    @Test fun darkDefaultKeepsLowVisionContrast() {
        // design §3.6: high contrast for low vision. Body text meets WCAG AAA (7:1) in the default theme.
        val c = brandColors(Appearance.DARK)
        assertContrast(7.0, c.onBackground, c.background, "text on background")
        assertContrast(7.0, c.onSurface, c.surface, "text on cards")
        assertContrast(7.0, c.onSurfaceVariant, c.surface, "secondary text on cards")
        assertContrast(7.0, c.onPrimary, c.primary, "button text")
        assertContrast(7.0, c.primary, c.background, "accent on background")
    }

    @Test fun lightThemeMeetsAa() {
        val c = brandColors(Appearance.LIGHT)
        assertContrast(7.0, c.onBackground, c.background, "text on background")
        assertContrast(4.5, c.onSurfaceVariant, c.surface, "secondary text on cards")
        assertContrast(4.5, c.onPrimary, c.primary, "button text")
        assertContrast(4.5, c.primary, c.background, "accent on background")
    }

    @Test fun cameraOverlaysStandOutFromTheirHalo() {
        // The 6 dp target outline and fingertip ring sit on a dark halo so they read on any camera image.
        for ((name, color) in listOf("target" to Overlay.target, "fingertip" to Overlay.fingertip,
                "tracking" to Overlay.quadTracking, "candidate" to Overlay.quadCandidate))
            assertContrast(7.0, color, Overlay.halo, name)
        assertTrue(Overlay.target != Overlay.fingertip, "target and fingertip must look different")
    }

    @Test fun brandColorsMatchTheWebsiteTokens() {
        // One theme across the app and fingerpost.web.app: the landing page's tokens are the source.
        val html = File("../../web/index.html").readText()
        fun token(name: String) = Regex("--$name:\\s*#([0-9a-fA-F]{6})").find(html)!!.groupValues[1].uppercase()
        fun hex(c: Color) = "%06X".format(c.toArgb() and 0xFFFFFF)
        assertEquals(token("fg"), hex(Brand.Ink))
        assertEquals(token("accent"), hex(Brand.Blue))
        assertEquals(token("panel"), hex(Brand.Mist))
        assertEquals(token("muted"), hex(Brand.Slate))
        assertEquals(token("peach"), hex(Brand.Peach))
        assertEquals(token("night"), hex(Brand.Night))
        assertEquals(token("night-text"), hex(Brand.NightText))
    }
}
