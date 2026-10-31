package io.github.fingerpost.onboarding

import android.content.Context
import androidx.datastore.preferences.preferencesDataStore

private val Context.tutorialData by preferencesDataStore(name = "tutorial")

fun onboardingStore(context: Context) = OnboardingStore(context.applicationContext.tutorialData)
