package io.github.fingerpost.settings

import io.github.fingerpost.R

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
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
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
    val resources = LocalResources.current
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
                        contentDescription = resources.getString(R.string.back)
                        role = Role.Button
                        onClick(label = resources.getString(R.string.navigate_back)) {
                            onBack()
                            true
                        }
                    }
                ) {
                    Text(resources.getString(R.string.back))
                }
                Text(
                    text = resources.getString(R.string.settings),
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.semantics { heading() }
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            SettingToggle(
                label = resources.getString(R.string.speech),
                checked = settings.speech,
                enabled = !settings.speech || settings.canDisableOutput(Output.SPEECH),
                onCheckedChange = { onUpdate(settings.copy(speech = it)) }
            )

            SettingToggle(
                label = resources.getString(R.string.tone),
                checked = settings.tone,
                enabled = !settings.tone || settings.canDisableOutput(Output.TONE),
                onCheckedChange = { onUpdate(settings.copy(tone = it)) }
            )

            SettingToggle(
                label = resources.getString(R.string.haptics),
                checked = settings.haptics,
                enabled = !settings.haptics || settings.canDisableOutput(Output.HAPTICS),
                onCheckedChange = { onUpdate(settings.copy(haptics = it)) }
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            val rates = listOf(0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
            val currentRateIdx = rates.indexOf(settings.speechRate).takeIf { it >= 0 } ?: 1
            val nextRate = rates[(currentRateIdx + 1) % rates.size]
            val rateState = resources.getString(R.string.rate_value, settings.speechRate.toString())
            SettingOption(
                label = resources.getString(R.string.speech_rate),
                state = rateState,
                onClick = { onUpdate(settings.copy(speechRate = nextRate)) }
            )

            val nextVerbosity = when (settings.verbosity) {
                Verbosity.NORMAL -> Verbosity.CONCISE
                Verbosity.CONCISE -> Verbosity.DETAILED
                Verbosity.DETAILED -> Verbosity.NORMAL
            }
            val verbosityState = when (settings.verbosity) {
                Verbosity.NORMAL -> resources.getString(R.string.normal)
                Verbosity.CONCISE -> resources.getString(R.string.concise)
                Verbosity.DETAILED -> resources.getString(R.string.detailed)
            }
            SettingOption(
                label = resources.getString(R.string.verbosity),
                state = verbosityState,
                onClick = { onUpdate(settings.copy(verbosity = nextVerbosity)) }
            )

            val nextHand = if (settings.handedness == Hand.RIGHT) Hand.LEFT else Hand.RIGHT
            val handState = if (settings.handedness == Hand.RIGHT) resources.getString(R.string.right) else resources.getString(R.string.left)
            SettingOption(
                label = resources.getString(R.string.handedness),
                state = handState,
                onClick = { onUpdate(settings.copy(handedness = nextHand)) }
            )

            val nextHold = if (settings.holdMode == HoldMode.HANDHELD) HoldMode.CHEST_MOUNT else HoldMode.HANDHELD
            val holdState = if (settings.holdMode == HoldMode.HANDHELD) resources.getString(R.string.handheld) else resources.getString(R.string.chest_mount)
            SettingOption(
                label = resources.getString(R.string.hold_mode),
                state = holdState,
                onClick = { onUpdate(settings.copy(holdMode = nextHold)) }
            )

            val locales = listOf("en" to resources.getString(R.string.english), "hi" to resources.getString(R.string.hindi), "es" to resources.getString(R.string.spanish))
            val currentLocIdx = locales.indexOfFirst { it.first == settings.locale.lowercase() }.takeIf { it >= 0 } ?: 0
            val nextLoc = locales[(currentLocIdx + 1) % locales.size]
            val locState = locales[currentLocIdx].second
            SettingOption(
                label = resources.getString(R.string.language),
                state = locState,
                onClick = { onUpdate(settings.copy(locale = nextLoc.first)) }
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            SettingToggle(
                label = resources.getString(R.string.private_mode),
                checked = settings.privateMode,
                onCheckedChange = { onUpdate(settings.copy(privateMode = it)) }
            )

            SettingToggle(
                label = resources.getString(R.string.offer_donations),
                checked = settings.offerDonations,
                enabled = !settings.privateMode,
                onCheckedChange = { onUpdate(settings.copy(offerDonations = it)) }
            )
            Text(resources.getString(R.string.donation_details), modifier = Modifier.padding(horizontal = 16.dp))

            SettingToggle(
                label = resources.getString(R.string.volume_keys),
                checked = settings.volumeKeys,
                onCheckedChange = { onUpdate(settings.copy(volumeKeys = it)) }
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            SettingAction(
                label = resources.getString(R.string.clear_saved),
                state = if (screensCleared) resources.getString(R.string.cleared) else resources.getString(R.string.saved_explanation),
                onClick = { onClearSavedScreens(); screensCleared = true }
            )
        }
    }
}

@Composable
private fun SettingToggle(
    label: String,
    enabled: Boolean = true,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    val resources = LocalResources.current
    val state = if (checked) resources.getString(R.string.state_on) else resources.getString(R.string.state_off)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 56.dp)
            .toggleable(
                value = checked,
                enabled = enabled,
                role = Role.Switch,
                onValueChange = onCheckedChange
            )
            .clearAndSetSemantics {
                contentDescription = label
                stateDescription = state
                role = Role.Switch
                if (!enabled) disabled()
                onClick(label = if (checked) resources.getString(R.string.turn_off) else resources.getString(R.string.turn_on)) {
                    if (enabled) onCheckedChange(!checked)
                    enabled
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
                text = if (checked) resources.getString(R.string.state_on) else resources.getString(R.string.state_off),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Switch(
            checked = checked,
            enabled = enabled,
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
    val resources = LocalResources.current
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
    val resources = LocalResources.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 56.dp)
            .clickable(onClick = onClick)
            .clearAndSetSemantics {
                contentDescription = label
                stateDescription = state
                role = Role.Button
                onClick(label = resources.getString(R.string.change_option, label)) {
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

