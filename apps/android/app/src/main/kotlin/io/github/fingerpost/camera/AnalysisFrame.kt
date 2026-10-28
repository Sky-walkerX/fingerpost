package io.github.fingerpost.camera

import android.graphics.Bitmap
import android.graphics.Rect

/** The receiver owns bitmap; crop/rotation describe the same upright frame as the preview. */
data class AnalysisFrame(
    val bitmap: Bitmap,
    val crop: Rect,
    val rotationDegrees: Int,
    val timestampMs: Long,
)
