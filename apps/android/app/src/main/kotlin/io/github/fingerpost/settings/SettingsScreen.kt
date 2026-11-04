package io.github.fingerpost.settings

import io.github.fingerpost.R

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.ui.draw.clip
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
    val context = androidx.compose.ui.platform.LocalContext.current
    val devices = remember(context) { io.github.fingerpost.memory.savedDevices(context) }
    var savedDevices by remember { mutableStateOf(devices.list(System.currentTimeMillis())) }
    var renaming by remember { mutableStateOf<io.github.fingerpost.guidance.SavedDevice?>(null) }
    var deviceName by remember { mutableStateOf("") }
    val resources = LocalResources.current
    renaming?.let { device ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { renaming = null },
            title = { Text(resources.getString(R.string.rename_device)) },
            text = { androidx.compose.material3.TextField(value = deviceName, onValueChange = { deviceName = it.take(40) }, label = { Text(resources.getString(R.string.device_name)) }) },
            confirmButton = { Button(onClick = { if (devices.rename(device.key,deviceName)) { savedDevices = devices.list(System.currentTimeMillis()); renaming = null } }) { Text(resources.getString(R.string.save_device)) } },
            dismissButton = { Button(onClick = { renaming = null }) { Text(resources.getString(R.string.cancel_device)) } },
        )
    }
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
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(28.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                Button(
                    onClick = onBack,
                    shape = RoundedCornerShape(22.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer,
                        contentColor = MaterialTheme.colorScheme.onSecondaryContainer),
                    modifier = Modifier.heightIn(min = 56.dp).clearAndSetSemantics {
                        contentDescription = resources.getString(R.string.back)
                        role = Role.Button
                        onClick(label = resources.getString(R.string.navigate_back)) {
                            onBack()
                            true
                        }
                    }
                ) {
                    Text(resources.getString(R.string.back), style = MaterialTheme.typography.labelLarge)
                }
                Text(
                    text = resources.getString(R.string.settings),
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.semantics { heading() }
                )
            }

            SettingsGroup(resources.getString(R.string.section_guidance)) {
                SettingToggle(
                    label = resources.getString(R.string.vibration_only),
                    checked = settings.vibrationOnly,
                    onCheckedChange = { onUpdate(if (it) settings.withVibrationOnly() else settings.copy(speech = true, tone = true)) }
                )
                GroupDivider()
                SettingToggle(
                    label = resources.getString(R.string.speech),
                    checked = settings.speech,
                    enabled = !settings.speech || settings.canDisableOutput(Output.SPEECH),
                    onCheckedChange = { onUpdate(settings.copy(speech = it)) }
                )
                GroupDivider()
                SettingToggle(
                    label = resources.getString(R.string.tone),
                    checked = settings.tone,
                    enabled = !settings.tone || settings.canDisableOutput(Output.TONE),
                    onCheckedChange = { onUpdate(settings.copy(tone = it)) }
                )
                GroupDivider()
                SettingToggle(
                    label = resources.getString(R.string.haptics),
                    checked = settings.haptics,
                    enabled = !settings.haptics || settings.canDisableOutput(Output.HAPTICS),
                    onCheckedChange = { onUpdate(settings.copy(haptics = it)) }
                )
            }

            SettingsGroup(resources.getString(R.string.section_voice)) {
                val rates = listOf(0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
                val currentRateIdx = rates.indexOf(settings.speechRate).takeIf { it >= 0 } ?: 1
                val nextRate = rates[(currentRateIdx + 1) % rates.size]
                SettingOption(
                    label = resources.getString(R.string.speech_rate),
                    state = resources.getString(R.string.rate_value, settings.speechRate.toString()),
                    onClick = { onUpdate(settings.copy(speechRate = nextRate)) }
                )
                GroupDivider()
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
                GroupDivider()
                val nextHand = if (settings.handedness == Hand.RIGHT) Hand.LEFT else Hand.RIGHT
                SettingOption(
                    label = resources.getString(R.string.handedness),
                    state = if (settings.handedness == Hand.RIGHT) resources.getString(R.string.right) else resources.getString(R.string.left),
                    onClick = { onUpdate(settings.copy(handedness = nextHand)) }
                )
                GroupDivider()
                val nextHold = if (settings.holdMode == HoldMode.HANDHELD) HoldMode.CHEST_MOUNT else HoldMode.HANDHELD
                SettingOption(
                    label = resources.getString(R.string.hold_mode),
                    state = if (settings.holdMode == HoldMode.HANDHELD) resources.getString(R.string.handheld) else resources.getString(R.string.chest_mount),
                    onClick = { onUpdate(settings.copy(holdMode = nextHold)) }
                )
                GroupDivider()
                val locales = listOf("en" to resources.getString(R.string.english), "hi" to resources.getString(R.string.hindi), "es" to resources.getString(R.string.spanish))
                val currentLocIdx = locales.indexOfFirst { it.first == settings.locale.lowercase() }.takeIf { it >= 0 } ?: 0
                val nextLoc = locales[(currentLocIdx + 1) % locales.size]
                SettingOption(
                    label = resources.getString(R.string.language),
                    state = locales[currentLocIdx].second,
                    onClick = { onUpdate(settings.copy(locale = nextLoc.first)) }
                )
            }

            SettingsGroup(resources.getString(R.string.section_privacy)) {
                SettingToggle(
                    label = resources.getString(R.string.private_mode),
                    checked = settings.privateMode,
                    onCheckedChange = { onUpdate(settings.copy(privateMode = it)) }
                )
                GroupDivider()
                SettingToggle(
                    label = resources.getString(R.string.offer_donations),
                    checked = settings.offerDonations,
                    enabled = !settings.privateMode,
                    onCheckedChange = { onUpdate(settings.copy(offerDonations = it)) }
                )
                Text(
                    resources.getString(R.string.donation_details),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 16.dp)
                )
                GroupDivider()
                SettingToggle(
                    label = resources.getString(R.string.volume_keys),
                    checked = settings.volumeKeys,
                    onCheckedChange = { onUpdate(settings.copy(volumeKeys = it)) }
                )
            }

            SettingsGroup(resources.getString(R.string.section_display)) {
                val light = settings.appearance == Appearance.LIGHT
                SettingOption(
                    label = resources.getString(R.string.appearance),
                    state = resources.getString(if (light) R.string.appearance_light else R.string.appearance_dark),
                    onClick = { onUpdate(settings.copy(appearance = if (light) Appearance.DARK else Appearance.LIGHT)) }
                )
            }

            SettingsGroup(resources.getString(R.string.my_devices)) {
                for (device in savedDevices) {
                    SettingAction(label = device.name, state = resources.getString(R.string.rename_device), onClick = { deviceName = device.name; renaming = device })
                    GroupDivider()
                    SettingAction(label = resources.getString(R.string.delete_device, device.name), state = "", onClick = { devices.delete(device.key); savedDevices = devices.list(System.currentTimeMillis()) })
                    GroupDivider()
                }
                SettingAction(
                    label = resources.getString(R.string.clear_saved),
                    state = if (screensCleared) resources.getString(R.string.cleared) else resources.getString(R.string.saved_explanation),
                    onClick = { onClearSavedScreens(); screensCleared = true }
                )
            }
        }
    }
}

/** A titled card of related settings. The title is a heading, so TalkBack users can jump between groups. */
@Composable
private fun SettingsGroup(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(start = 4.dp).semantics { heading() }
        )
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(MaterialTheme.colorScheme.surface),
            content = content
        )
    }
}

@Composable
private fun GroupDivider() =
    HorizontalDivider(modifier = Modifier.padding(horizontal = 20.dp), color = MaterialTheme.colorScheme.outlineVariant)

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
            .padding(horizontal = 20.dp, vertical = 14.dp),
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
            .padding(horizontal = 20.dp, vertical = 14.dp),
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
            .padding(horizontal = 20.dp, vertical = 14.dp),
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

