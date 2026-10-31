package io.github.fingerpost

import android.app.Activity
import android.app.Instrumentation
import android.os.Bundle
import io.github.fingerpost.guidance.Vec2
import io.github.fingerpost.vision.ScreenTracker
import io.github.fingerpost.vision.TrackState
import org.opencv.android.OpenCVLoader
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.Point
import org.opencv.core.Scalar
import org.opencv.imgproc.Imgproc

/** Synthetic matrices exercise real Android OpenCV; no camera frames, media files or network are used. */
internal object DeviceTrackingCheck {
    fun run(instrumentation: Instrumentation) {
        var passed = 0
        val failures = mutableListOf<String>()
        fun check(name: String, test: () -> Unit) {
            try { test(); passed++ } catch (error: Throwable) { failures += "$name:${error.javaClass.simpleName}" }
        }
        val ready = OpenCVLoader.initLocal()
        val quad = listOf(Vec2(30.0, 30.0), Vec2(290.0, 30.0), Vec2(290.0, 210.0), Vec2(30.0, 210.0))
        fun frame(textured: Boolean): Mat {
            val gray = Mat(240, 320, CvType.CV_8UC1, Scalar(0.0))
            if (textured) for (y in 45..190 step 20) for (x in 45..270 step 20)
                Imgproc.rectangle(gray, Point(x.toDouble(), y.toDouble()), Point(x + 8.0, y + 8.0), Scalar(255.0), -1)
            return gray
        }
        fun withTracker(textured: Boolean, test: (ScreenTracker, Mat) -> Unit) {
            check(ready)
            val tracker = ScreenTracker()
            val gray = frame(textured)
            try { tracker.reanchor(quad); test(tracker, gray) }
            finally { tracker.reset(); gray.release() }
        }
        check("anchor_needs_feature_validation") { withTracker(false) { tracker, _ -> check(tracker.state != TrackState.TRACKING) } }
        check("unvalidated_transform_unavailable") { withTracker(false) { tracker, _ -> check(tracker.imageToScreen == null) } }
        check("blank_frames_never_track") { withTracker(false) { tracker, gray ->
            repeat(3) { tracker.update(gray, null, it * 100L); check(tracker.state != TrackState.TRACKING) }
        } }
        check("features_validate_tracking") { withTracker(true) { tracker, gray ->
            tracker.update(gray, null, 0)
            tracker.update(gray, null, 100)
            check(tracker.state == TrackState.TRACKING && tracker.imageToScreen != null)
        } }
        check("reanchor_requires_fresh_validation") { withTracker(true) { tracker, gray ->
            tracker.update(gray, null, 0); tracker.update(gray, null, 100)
            check(tracker.state == TrackState.TRACKING)
            tracker.reanchor(quad)
            check(tracker.state != TrackState.TRACKING && tracker.imageToScreen == null)
            tracker.update(gray, null, 200); tracker.update(gray, null, 300)
            check(tracker.state == TrackState.TRACKING)
        } }
        check("unacquired_anchor_becomes_lost") { withTracker(false) { tracker, gray ->
            repeat(6) { tracker.update(gray, null, it * 100L) }
            check(tracker.state == TrackState.DEGRADED && tracker.imageToScreen == null)
            tracker.update(gray, null, 1_500)
            check(tracker.state == TrackState.LOST && tracker.imageToScreen == null)
        } }
        val result = Bundle().apply {
            putInt("tests", passed + failures.size); putInt("passed", passed); putInt("failed", failures.size)
            putString("failures", failures.joinToString(","))
        }
        instrumentation.finish(if (failures.isEmpty()) Activity.RESULT_OK else Activity.RESULT_CANCELED, result)
    }
}
