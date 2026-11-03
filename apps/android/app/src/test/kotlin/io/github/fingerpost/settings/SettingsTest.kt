package io.github.fingerpost.settings

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import java.nio.file.Path
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir

class SettingsTest {
    @TempDir
    lateinit var directory: Path

    @Test
    fun defaultsMatchSpec() = runBlocking {
        val defaultSettings = Settings()
        assertTrue(defaultSettings.speech)
        assertTrue(defaultSettings.tone)
        assertTrue(defaultSettings.haptics)
        assertEquals(1.0f, defaultSettings.speechRate)
        assertEquals(Verbosity.NORMAL, defaultSettings.verbosity)
        assertEquals(Hand.RIGHT, defaultSettings.handedness)
        assertEquals(HoldMode.HANDHELD, defaultSettings.holdMode)
        assertEquals("en", defaultSettings.locale)
        assertFalse(defaultSettings.privateMode)
        assertFalse(defaultSettings.volumeKeys)
        assertFalse(defaultSettings.offerDonations)

        val job = SupervisorJob()
        val data = PreferenceDataStoreFactory.create(
            scope = CoroutineScope(job + Dispatchers.IO),
            produceFile = { directory.resolve("defaults.preferences_pb").toFile() }
        )
        try {
            val loaded = SettingsStore(data).settings.first()
            assertEquals(defaultSettings, loaded)
        } finally {
            job.cancelAndJoin()
        }
    }

    @Test
    fun saveLoadRoundTripEveryField() = runBlocking {
        val file = directory.resolve("roundtrip.preferences_pb").toFile()
        val custom = Settings(
            speech = false,
            tone = false,
            haptics = true,
            speechRate = 1.5f,
            verbosity = Verbosity.CONCISE,
            handedness = Hand.LEFT,
            holdMode = HoldMode.CHEST_MOUNT,
            locale = "es",
            privateMode = true,
            volumeKeys = true,
            offerDonations = true
        )

        val firstJob = SupervisorJob()
        val firstData = PreferenceDataStoreFactory.create(
            scope = CoroutineScope(firstJob + Dispatchers.IO),
            produceFile = { file }
        )
        try {
            val store = SettingsStore(firstData)
            store.save(custom)
            val loaded = store.settings.first()
            assertEquals(custom, loaded)
        } finally {
            firstJob.cancelAndJoin()
        }

        // Reopening the datastore preserves every field
        val reopenJob = SupervisorJob()
        val reopenedData = PreferenceDataStoreFactory.create(
            scope = CoroutineScope(reopenJob + Dispatchers.IO),
            produceFile = { file }
        )
        try {
            val reopenedStore = SettingsStore(reopenedData)
            val reloaded = reopenedStore.settings.first()
            assertEquals(custom, reloaded)
            assertEquals(false, reloaded.speech)
            assertEquals(false, reloaded.tone)
            assertEquals(true, reloaded.haptics)
            assertEquals(1.5f, reloaded.speechRate)
            assertEquals(Verbosity.CONCISE, reloaded.verbosity)
            assertEquals(Hand.LEFT, reloaded.handedness)
            assertEquals(HoldMode.CHEST_MOUNT, reloaded.holdMode)
            assertEquals("es", reloaded.locale)
            assertEquals(true, reloaded.privateMode)
            assertEquals(true, reloaded.volumeKeys)
        } finally {
            reopenJob.cancelAndJoin()
        }
    }

    @Test
    fun safeFallbackWhenStoredValueIsInvalid() = runBlocking {
        val job = SupervisorJob()
        val data = PreferenceDataStoreFactory.create(
            scope = CoroutineScope(job + Dispatchers.IO),
            produceFile = { directory.resolve("invalid.preferences_pb").toFile() }
        )
        try {
            data.edit { prefs ->
                prefs[stringPreferencesKey("verbosity")] = "UNKNOWN_VERBOSITY"
                prefs[stringPreferencesKey("handedness")] = "AMBIDEXTROUS"
                prefs[stringPreferencesKey("hold_mode")] = "POCKET"
                prefs[stringPreferencesKey("locale")] = "fr"
                prefs[floatPreferencesKey("speech_rate")] = -5.0f
            }
            val loaded = SettingsStore(data).settings.first()
            assertEquals(Verbosity.NORMAL, loaded.verbosity)
            assertEquals(Hand.RIGHT, loaded.handedness)
            assertEquals(HoldMode.HANDHELD, loaded.holdMode)
            assertEquals("en", loaded.locale)
            assertEquals(1.0f, loaded.speechRate)

            // Test another invalid locale outside en/hi/es (e.g. "de")
            data.edit { prefs ->
                prefs[stringPreferencesKey("locale")] = "de"
                prefs[floatPreferencesKey("speech_rate")] = Float.NaN
            }
            val loaded2 = SettingsStore(data).settings.first()
            assertEquals("en", loaded2.locale)
            assertEquals(1.0f, loaded2.speechRate)

            // Supported locales "hi" and "es" should be accepted
            data.edit { prefs ->
                prefs[stringPreferencesKey("locale")] = "hi"
            }
            assertEquals("hi", SettingsStore(data).settings.first().locale)

            data.edit { prefs ->
                prefs[stringPreferencesKey("locale")] = "es"
            }
            assertEquals("es", SettingsStore(data).settings.first().locale)
        } finally {
            job.cancelAndJoin()
        }
    }
    @Test fun cannotDisableTheLastOutputAndLegacySettingsRecoverSpeech() = runBlocking {
        val silent = Settings(speech = false, tone = false, haptics = false)
        assertTrue(silent.safeOutputs().speech)
        assertFalse(Settings(tone = false, haptics = false).canDisableOutput(Output.SPEECH))
        assertFalse(Settings(speech = false, haptics = false).canDisableOutput(Output.TONE))
        assertFalse(Settings(speech = false, tone = false).canDisableOutput(Output.HAPTICS))
        assertTrue(Settings().canDisableOutput(Output.SPEECH))
        val job = SupervisorJob()
        val data = PreferenceDataStoreFactory.create(scope = CoroutineScope(job + Dispatchers.IO),
            produceFile = { directory.resolve("outputs.preferences_pb").toFile() })
        try {
            val store = SettingsStore(data)
            org.junit.jupiter.api.assertThrows<IllegalArgumentException> { runBlocking { store.save(silent) } }
            data.edit { prefs ->
                for (key in listOf("speech", "tone", "haptics"))
                    prefs[androidx.datastore.preferences.core.booleanPreferencesKey(key)] = false
            }
            assertTrue(store.settings.first().speech)
        } finally { job.cancelAndJoin() }
    }
    @Test fun volumeKeysOnlyConsumeFreshForegroundActionsWhenEnabled() {
        assertNullAction(Settings(), HardwareCue.REPEAT)
        assertEquals(HardwareCue.REPEAT, Settings(volumeKeys = true).hardwareCue(true, false, HardwareCue.REPEAT))
        assertEquals(null, Settings(volumeKeys = true).hardwareCue(false, false, HardwareCue.UNDER_FINGER))
        assertEquals(null, Settings(volumeKeys = true).hardwareCue(true, true, HardwareCue.REPEAT))
    }
    private fun assertNullAction(settings: Settings, cue: HardwareCue) =
        assertEquals(null, settings.hardwareCue(true, false, cue))

}

