package io.github.fingerpost.ui

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import io.github.fingerpost.R
import io.github.fingerpost.settings.Appearance

/** The brand palette. The first seven values are the website's tokens (apps/web/index.html); BrandThemeTest keeps them equal. */
object Brand {
    val Ink = Color(0xFF0F1C35)
    val Blue = Color(0xFF2F5FD6)
    val Mist = Color(0xFFEFF4FC)
    val Slate = Color(0xFF4B5873)
    val Peach = Color(0xFFFFB98F)
    val Night = Color(0xFF0D1830)
    val NightText = Color(0xFFC9D4EA)
    val NightCard = Color(0xFF16264A)
    val NightRaised = Color(0xFF1F3260)
    val Periwinkle = Color(0xFFA9C1FF)
    val Line = Color(0xFFDBE3F1)
    val White = Color(0xFFFFFFFF)
}

/** Colours drawn over the live camera image. Each sits on a dark halo so it reads on any background. */
object Overlay {
    val halo = Brand.Night
    val target = Brand.Peach
    val fingertip = Brand.White
    val quadTracking = Brand.Periwinkle
    val quadCandidate = Brand.NightText
    val panel = Brand.Night.copy(alpha = 0.9f)
}

private val Dark = darkColorScheme(
    primary = Brand.Periwinkle, onPrimary = Brand.Night,
    primaryContainer = Brand.NightRaised, onPrimaryContainer = Brand.White,
    secondary = Brand.Periwinkle, onSecondary = Brand.Night,
    secondaryContainer = Brand.NightRaised, onSecondaryContainer = Brand.White,
    tertiary = Brand.Peach, onTertiary = Brand.Night,
    background = Brand.Night, onBackground = Brand.White,
    surface = Brand.NightCard, onSurface = Brand.White,
    surfaceVariant = Brand.NightRaised, onSurfaceVariant = Brand.NightText,
    surfaceDim = Brand.Night, surfaceBright = Brand.NightRaised,
    surfaceContainerLowest = Brand.Night, surfaceContainerLow = Brand.NightCard,
    surfaceContainer = Brand.NightCard, surfaceContainerHigh = Brand.NightRaised,
    surfaceContainerHighest = Brand.NightRaised,
    outline = Color(0xFF8193BA), outlineVariant = Color(0xFF34477A),
    inverseSurface = Brand.White, inverseOnSurface = Brand.Ink, inversePrimary = Brand.Blue,
)

private val Light = lightColorScheme(
    primary = Brand.Blue, onPrimary = Brand.White,
    primaryContainer = Brand.Mist, onPrimaryContainer = Brand.Ink,
    secondary = Brand.Blue, onSecondary = Brand.White,
    secondaryContainer = Color(0xFFDCE6FF), onSecondaryContainer = Brand.Ink,
    tertiary = Color(0xFF9A4A1E), onTertiary = Brand.White,
    background = Brand.White, onBackground = Brand.Ink,
    surface = Brand.Mist, onSurface = Brand.Ink,
    surfaceVariant = Color(0xFFE3EAF7), onSurfaceVariant = Brand.Slate,
    surfaceDim = Color(0xFFE3EAF7), surfaceBright = Brand.White,
    surfaceContainerLowest = Brand.White, surfaceContainerLow = Brand.Mist,
    surfaceContainer = Brand.Mist, surfaceContainerHigh = Color(0xFFE6EDF9),
    surfaceContainerHighest = Color(0xFFDDE5F4),
    outline = Color(0xFF6E7C98), outlineVariant = Brand.Line,
    inverseSurface = Brand.Night, inverseOnSurface = Brand.White, inversePrimary = Brand.Periwinkle,
)

fun brandColors(appearance: Appearance): ColorScheme = if (appearance == Appearance.LIGHT) Light else Dark

/** Display serif for headings, a humanist sans for everything read in running text. Both are OFL fonts bundled in res/font. */
val Display = FontFamily(Font(R.font.instrument_serif_regular))
private fun hanken(weight: Int) = Font(R.font.hanken_grotesk, FontWeight(weight),
    variationSettings = FontVariation.Settings(FontVariation.weight(weight)))
val Sans = FontFamily(hanken(400), hanken(500), hanken(600), hanken(700))

// Low vision: running text stays at 22 sp and scales with the system font size.
private val Body = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Normal, fontSize = 22.sp, lineHeight = 31.sp)
private val Type = Typography(
    displaySmall = TextStyle(fontFamily = Display, fontSize = 44.sp, lineHeight = 48.sp),
    headlineMedium = TextStyle(fontFamily = Display, fontSize = 36.sp, lineHeight = 42.sp),
    headlineSmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Medium, fontSize = 26.sp, lineHeight = 35.sp),
    titleLarge = TextStyle(fontFamily = Display, fontSize = 40.sp, lineHeight = 46.sp),
    titleMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, lineHeight = 28.sp),
    bodyLarge = Body.copy(fontWeight = FontWeight.Medium),
    bodyMedium = Body,
    labelLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 22.sp, lineHeight = 28.sp),
)

@Composable
fun FingerpostTheme(appearance: Appearance = Appearance.DARK, content: @Composable () -> Unit) {
    val colors = brandColors(appearance)
    // Text outside a Surface (gates, error states) still gets the theme's text colour, never Compose's black default.
    MaterialTheme(colorScheme = colors, typography = Type) {
        CompositionLocalProvider(LocalContentColor provides colors.onBackground, content = content)
    }
}
