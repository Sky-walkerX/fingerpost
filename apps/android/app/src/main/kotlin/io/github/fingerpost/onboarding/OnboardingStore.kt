package io.github.fingerpost.onboarding

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class OnboardingStore(private val store: DataStore<Preferences>) {
    val completed: Flow<Boolean> = store.data.map { it[COMPLETED] ?: false }
    suspend fun markCompleted() { store.edit { it[COMPLETED] = true } }

    private companion object { val COMPLETED = booleanPreferencesKey("tutorial_completed") }
}
