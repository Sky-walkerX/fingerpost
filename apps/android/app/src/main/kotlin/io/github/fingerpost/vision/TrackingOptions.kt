package io.github.fingerpost.vision

import android.content.Intent
import com.google.mediapipe.tasks.core.Delegate
import io.github.fingerpost.BuildConfig

/** Intent overrides are diagnostic only; release builds always use the specified defaults. */
data class TrackingOptions(val delegate: Delegate = Delegate.GPU, val maxHands: Int = 1) {
    init { require(maxHands in 1..2) }

    companion object {
        fun fromIntent(intent: Intent): TrackingOptions {
            if (!BuildConfig.DEBUG) return TrackingOptions()
            val delegate = if (intent.getStringExtra("fp.profile.delegate") == "CPU") Delegate.CPU else Delegate.GPU
            val maxHands = if (intent.getIntExtra("fp.profile.hands", 1) == 2) 2 else 1
            return TrackingOptions(delegate, maxHands)
        }
    }
}
