package io.github.fingerpost.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp

@Composable
fun SettingsScreen(
    settings: Settings,
    onUpdate: (Settings) -> Unit,
    onBack: () -> Unit,
    /** A5-2: empties the on-device layout cache. */
    onClearSavedScreens: () -> Unit = {},
) {
    var screensCleared by remember { mutableStateOf(false) }
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .safeDrawingPadding()
                .verticalScroll(rememberScrollState())
                .padding(vertical = 16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Button(
                    onClick = onBack,
                    modifier = Modifier.clearAndSetSemantics {
                        contentDescription = "Back"
                        role = Role.Button
                        onClick(label = "Navigate back") {
                            onBack()
                            true
                        }
                    }
                ) {
                    Text("Back")
                }
                Text(
                    text = "Settings",
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.semantics { heading() }
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            SettingToggle(
                label = "Speech",
                checked = settings.speech,
                onCheckedChange = { onUpdate(settings.copy(speech = it)) }
            )

            SettingToggle(
                label = "Tone",
                checked = settings.tone,
                onCheckedChange = { onUpdate(settings.copy(tone = it)) }
            )

            SettingToggle(
                label = "Haptics",
                checked = settings.haptics,
                onCheckedChange = { onUpdate(settings.copy(haptics = it)) }
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            val rates = listOf(0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
            val currentRateIdx = rates.indexOf(settings.speechRate).takeIf { it >= 0 } ?: 1
            val nextRate = rates[(currentRateIdx + 1) % rates.size]
            val rateState = "${settings.speechRate}x"
            SettingOption(
                label = "Speech rate",
                state = rateState,
                onClick = { onUpdate(settings.copy(speechRate = nextRate)) }
            )

            val nextVerbosity = when (settings.verbosity) {
                Verbosity.NORMAL -> Verbosity.CONCISE
                Verbosity.CONCISE -> Verbosity.DETAILED
                Verbosity.DETAILED -> Verbosity.NORMAL
            }
            val verbosityState = when (settings.verbosity) {
                Verbosity.NORMAL -> "Normal"
                Verbosity.CONCISE -> "Concise"
                Verbosity.DETAILED -> "Detailed"
            }
            SettingOption(
                label = "Verbosity",
                state = verbosityState,
                onClick = { onUpdate(settings.copy(verbosity = nextVerbosity)) }
            )

            val nextHand = if (settings.handedness == Hand.RIGHT) Hand.LEFT else Hand.RIGHT
            val handState = if (settings.handedness == Hand.RIGHT) "Right" else "Left"
            SettingOption(
                label = "Handedness",
                state = handState,
                onClick = { onUpdate(settings.copy(handedness = nextHand)) }
            )

            val nextHold = if (settings.holdMode == HoldMode.HANDHELD) HoldMode.CHEST_MOUNT else HoldMode.HANDHELD
            val holdState = if (settings.holdMode == HoldMode.HANDHELD) "Handheld" else "Chest mount"
            SettingOption(
                label = "Hold mode",
                state = holdState,
                onClick = { onUpdate(settings.copy(holdMode = nextHold)) }
            )

            val locales = listOf("en" to "English", "hi" to "Hindi", "es" to "Spanish")
            val currentLocIdx = locales.indexOfFirst { it.first == settings.locale.lowercase() }.takeIf { it >= 0 } ?: 0
            val nextLoc = locales[(currentLocIdx + 1) % locales.size]
            val locState = locales[currentLocIdx].second
            SettingOption(
                label = "Language",
                state = locState,
                onClick = { onUpdate(settings.copy(locale = nextLoc.first)) }
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            SettingToggle(
                label = "Private mode",
                checked = settings.privateMode,
                onCheckedChange = { onUpdate(settings.copy(privateMode = it)) }
            )

            SettingToggle(
                label = "Volume keys",
                checked = settings.volumeKeys,
                onCheckedChange = { onUpdate(settings.copy(volumeKeys = it)) }
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            SettingAction(
                label = "Clear saved screens",
                state = if (screensCleared) "Cleared" else "Screens you used are remembered on this phone",
                onClick = { onClearSavedScreens(); screensCleared = true }
            )
        }
    }
}

@Composable
private fun SettingToggle(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    val state = if (checked) "on" else "off"
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 56.dp)
            .toggleable(
                value = checked,
                role = Role.Switch,
                onValueChange = onCheckedChange
            )
            .clearAndSetSemantics {
                contentDescription = label
                stateDescription = state
                role = Role.Switch
                onClick(label = if (checked) "Turn off" else "Turn on") {
                    onCheckedChange(!checked)
                    true
                }
            }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(end = 16.dp)
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyLarge
            )
            Text(
                text = if (checked) "On" else "Off",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = null
        )
    }
}

/** A one-shot action (not a value to cycle through), read as "label, button, state". */
@Composable
private fun SettingAction(
    label: String,
    state: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 56.dp)
            .clickable(onClick = onClick)
            .clearAndSetSemantics {
                contentDescription = label
                stateDescription = state
                role = Role.Button
                onClick(label = label) {
                    onClick()
                    true
                }
            }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = label, style = MaterialTheme.typography.bodyLarge)
            Text(text = state, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun SettingOption(
    label: String,
    state: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 56.dp)
            .clickable(onClick = onClick)
            .clearAndSetSemantics {
                contentDescription = label
                stateDescription = state
                role = Role.Button
                onClick(label = "Change $label") {
                    onClick()
                    true
                }
            }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(end = 16.dp)
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyLarge
            )
            Text(
                text = state,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

