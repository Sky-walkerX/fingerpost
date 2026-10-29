package io.github.fingerpost.vision

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions

/** design §4.7: every `full` keyframe has faces painted black (boxes expanded 20%) before encoding. */
class FaceCover {
    private val detector = FaceDetection.getClient(
        FaceDetectorOptions.Builder().setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST).build())
    private val black = Paint().apply { color = Color.BLACK; style = Paint.Style.FILL }

    /** Returns a new bitmap. If detection fails the whole frame is blacked out: never upload an unchecked face. */
    fun cover(bitmap: Bitmap): Bitmap {
        val out = bitmap.copy(Bitmap.Config.ARGB_8888, true)
        val canvas = Canvas(out)
        val faces = runCatching { Tasks.await(detector.process(InputImage.fromBitmap(bitmap, 0))) }.getOrNull()
        if (faces == null) {
            canvas.drawColor(Color.BLACK)
            return out
        }
        for (face in faces) {
            val r = RectF(face.boundingBox)
            val dx = r.width() * 0.1f
            val dy = r.height() * 0.1f
            canvas.drawRect(r.left - dx, r.top - dy, r.right + dx, r.bottom + dy, black)
        }
        return out
    }

    fun close() = detector.close()
}
