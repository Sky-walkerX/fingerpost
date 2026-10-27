package io.github.fingerpost.guidance

import kotlin.math.max
import kotlin.math.min

data class FramePoint(val x: Float, val y: Float)

/** Uniform scale and centered offset, shared by model letterboxing and preview cropping. */
data class FrameTransform(val scale: Float, val offsetX: Float, val offsetY: Float) {
    fun map(x: Float, y: Float): FramePoint = FramePoint(x * scale + offsetX, y * scale + offsetY)
    fun unmap(x: Float, y: Float): FramePoint = FramePoint((x - offsetX) / scale, (y - offsetY) / scale)

    companion object {
        fun fitCenter(frameW: Int, frameH: Int, viewW: Int, viewH: Int): FrameTransform =
            centered(frameW, frameH, viewW, viewH, fill = false)

        fun fillCenter(frameW: Int, frameH: Int, viewW: Int, viewH: Int): FrameTransform =
            centered(frameW, frameH, viewW, viewH, fill = true)

        private fun centered(frameW: Int, frameH: Int, viewW: Int, viewH: Int, fill: Boolean): FrameTransform {
            require(frameW > 0 && frameH > 0 && viewW > 0 && viewH > 0)
            val sx = viewW.toFloat() / frameW
            val sy = viewH.toFloat() / frameH
            val scale = if (fill) max(sx, sy) else min(sx, sy)
            return FrameTransform(scale, (viewW - frameW * scale) / 2f, (viewH - frameH * scale) / 2f)
        }
    }
}
