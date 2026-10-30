package io.github.fingerpost.vision

import android.graphics.Bitmap
import android.graphics.Matrix
import io.github.fingerpost.camera.AnalysisFrame
import io.github.fingerpost.guidance.FrameTransform
import org.opencv.android.Utils
import org.opencv.core.Core
import org.opencv.core.Mat
import org.opencv.imgproc.Imgproc

/** Size of the analysis frame once cropped and rotated upright (the frame hand samples are reported in). */
fun uprightSize(frame: AnalysisFrame): Pair<Int, Int> =
    if (frame.rotationDegrees % 180 == 0) frame.crop.width() to frame.crop.height()
    else frame.crop.height() to frame.crop.width()

/** Upright copy, optionally fitted inside a height bound without padding or stretching. Caller recycles it. */
fun uprightBitmap(frame: AnalysisFrame, width: Int, maxHeight: Int? = null): Bitmap {
    val crop = frame.crop
    val (uprightWidth, uprightHeight) = uprightSize(frame)
    val scale = if (maxHeight == null) width.toFloat() / uprightWidth
        else FrameTransform.fitCenter(uprightWidth, uprightHeight, width, maxHeight).scale
    val matrix = Matrix().apply {
        postRotate(frame.rotationDegrees.toFloat())
        postScale(scale, scale)
    }
    val result = Bitmap.createBitmap(frame.bitmap, crop.left, crop.top, crop.width(), crop.height(), matrix, true)
    return if (result === frame.bitmap) result.copy(Bitmap.Config.ARGB_8888, false) else result
}

/** Grayscale and HSV value channel of an ARGB_8888 bitmap. Both must be released by the caller. */
class FrameMats(val gray: Mat, val value: Mat) {
    fun release() {
        gray.release()
        value.release()
    }

    companion object {
        fun of(bitmap: Bitmap): FrameMats {
            val rgba = Mat()
            Utils.bitmapToMat(bitmap, rgba)
            val gray = Mat()
            Imgproc.cvtColor(rgba, gray, Imgproc.COLOR_RGBA2GRAY)
            val rgb = Mat()
            Imgproc.cvtColor(rgba, rgb, Imgproc.COLOR_RGBA2RGB)
            val hsv = Mat()
            Imgproc.cvtColor(rgb, hsv, Imgproc.COLOR_RGB2HSV)
            val value = Mat()
            Core.extractChannel(hsv, value, 2)
            rgba.release()
            rgb.release()
            hsv.release()
            return FrameMats(gray, value)
        }
    }
}
