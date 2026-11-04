package io.github.fingerpost.settings

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

enum class Output { SPEECH, TONE, HAPTICS }
enum class HardwareCue { REPEAT, UNDER_FINGER }

enum class Verbosity { NORMAL, CONCISE, DETAILED }
enum class Hand { RIGHT, LEFT }
enum class HoldMode { HANDHELD, CHEST_MOUNT }

data class Settings(
    val speech: Boolean = true,
    val tone: Boolean = true,
    val haptics: Boolean = true,
    val speechRate: Float = 1.0f,
    val verbosity: Verbosity = Verbosity.NORMAL,
    val handedness: Hand = Hand.RIGHT,
    val holdMode: HoldMode = HoldMode.HANDHELD,
    val locale: String = "en",
    val privateMode: Boolean = false,
    val volumeKeys: Boolean = false,
    val offerDonations: Boolean = false
) {
    val vibrationOnly: Boolean get() = !speech && !tone && haptics
    fun withVibrationOnly() = copy(speech = false, tone = false, haptics = true)
    fun safeOutputs(): Settings = if (!speech && !tone && !haptics) copy(speech = true) else this
    fun canDisableOutput(output: Output): Boolean = when (output) {
        Output.SPEECH -> tone || haptics
        Output.TONE -> speech || haptics
        Output.HAPTICS -> speech || tone
    }
    fun hardwareCue(foreground: Boolean, repeated: Boolean, cue: HardwareCue): HardwareCue? =
        cue.takeIf { volumeKeys && foreground && !repeated }
}

private val Context.settingsDataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

fun settingsStore(context: Context): SettingsStore =
    SettingsStore(context.applicationContext.settingsDataStore)

class SettingsStore(private val store: DataStore<Preferences>) {
    val settings: Flow<Settings> = store.data.map { prefs ->
        val verbosity = prefs[VERBOSITY]?.let { raw ->
            runCatching { Verbosity.valueOf(raw.trim().uppercase()) }.getOrNull()
        } ?: Verbosity.NORMAL

        val handedness = prefs[HANDEDNESS]?.let { raw ->
            runCatching { Hand.valueOf(raw.trim().uppercase()) }.getOrNull()
        } ?: Hand.RIGHT

        val holdMode = prefs[HOLD_MODE]?.let { raw ->
            runCatching { HoldMode.valueOf(raw.trim().uppercase()) }.getOrNull()
        } ?: HoldMode.HANDHELD

        val locale = prefs[LOCALE]?.trim()?.lowercase()?.takeIf { it in SUPPORTED_LOCALES } ?: "en"

        val speechRate = prefs[SPEECH_RATE]?.takeIf { it.isFinite() && it > 0f } ?: 1.0f

        Settings(
            speech = prefs[SPEECH] ?: true,
            tone = prefs[TONE] ?: true,
            haptics = prefs[HAPTICS] ?: true,
            speechRate = speechRate,
            verbosity = verbosity,
            handedness = handedness,
            holdMode = holdMode,
            locale = locale,
            privateMode = prefs[PRIVATE_MODE] ?: false,
            volumeKeys = prefs[VOLUME_KEYS] ?: false,
            offerDonations = prefs[OFFER_DONATIONS] ?: false
        ).safeOutputs()
    }

    suspend fun save(settings: Settings) {
        require(settings.speech || settings.tone || settings.haptics) { "At least one guidance output is required" }
        store.edit { prefs ->
            prefs[SPEECH] = settings.speech
            prefs[TONE] = settings.tone
            prefs[HAPTICS] = settings.haptics
            prefs[SPEECH_RATE] = settings.speechRate
            prefs[VERBOSITY] = settings.verbosity.name
            prefs[HANDEDNESS] = settings.handedness.name
            prefs[HOLD_MODE] = settings.holdMode.name
            prefs[LOCALE] = settings.locale
            prefs[PRIVATE_MODE] = settings.privateMode
            prefs[VOLUME_KEYS] = settings.volumeKeys
            prefs[OFFER_DONATIONS] = settings.offerDonations
        }
    }

    private companion object {
        val SPEECH = booleanPreferencesKey("speech")
        val TONE = booleanPreferencesKey("tone")
        val HAPTICS = booleanPreferencesKey("haptics")
        val SPEECH_RATE = floatPreferencesKey("speech_rate")
        val VERBOSITY = stringPreferencesKey("verbosity")
        val HANDEDNESS = stringPreferencesKey("handedness")
        val HOLD_MODE = stringPreferencesKey("hold_mode")
        val LOCALE = stringPreferencesKey("locale")
        val PRIVATE_MODE = booleanPreferencesKey("private_mode")
        val VOLUME_KEYS = booleanPreferencesKey("volume_keys")
        val OFFER_DONATIONS = booleanPreferencesKey("offer_donations")

        val SUPPORTED_LOCALES = setOf("en", "hi", "es")
    }
}

