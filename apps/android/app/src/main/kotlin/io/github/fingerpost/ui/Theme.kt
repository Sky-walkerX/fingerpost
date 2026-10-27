package io.github.fingerpost.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.sp

private val Colors = darkColorScheme(
    primary = Color(0xFFFFD400), onPrimary = Color.Black,
    secondary = Color(0xFFFFD400), onSecondary = Color.Black,
    background = Color.Black, onBackground = Color.White,
    surface = Color.Black, onSurface = Color.White,
)
private val LargeText = TextStyle(fontSize = 22.sp, lineHeight = 30.sp)
private val Type = Typography(bodyLarge = LargeText, bodyMedium = LargeText, labelLarge = LargeText)

@Composable
fun FingerpostTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Colors, typography = Type, content = content)
}
