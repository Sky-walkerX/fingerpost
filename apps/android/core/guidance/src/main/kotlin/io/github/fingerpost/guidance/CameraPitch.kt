package io.github.fingerpost.guidance

import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot

/** Camera tilt below the horizon from TYPE_GRAVITY, independent of screen rotation (guidance-spec §6). */
fun cameraPitchBelowHorizon(gx: Double, gy: Double, gz: Double): Double =
    Math.toDegrees(atan2(abs(gz), hypot(gx, gy)))
