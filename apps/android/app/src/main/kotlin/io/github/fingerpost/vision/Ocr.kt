package io.github.fingerpost.vision

import android.graphics.Bitmap
import android.graphics.Rect
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import io.github.fingerpost.guidance.OcrToken

/** On-device OCR (Latin + Devanagari), word level, boxes normalized to the bitmap. Blocking: call off the UI thread. */
class Ocr {
    private val latin = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    private val deva = TextRecognition.getClient(DevanagariTextRecognizerOptions.Builder().build())

    fun recognize(bitmap: Bitmap): List<OcrToken> {
        val image = InputImage.fromBitmap(bitmap, 0)
        val words = ArrayList<Pair<String, Rect>>()
        for (recognizer in listOf(latin, deva)) {
            val text = runCatching { Tasks.await(recognizer.process(image)) }.getOrNull() ?: continue
            words += elements(text)
        }
        val unique = ArrayList<Pair<String, Rect>>()
        for (word in words) if (unique.none { it.first == word.first && iou(it.second, word.second) > 0.5 }) unique += word
        val w = bitmap.width.toDouble()
        val h = bitmap.height.toDouble()
        return unique.map { (text, r) -> OcrToken(text, r.left / w, r.top / h, r.width() / w, r.height() / h) }
    }

    fun close() {
        latin.close()
        deva.close()
    }

    private fun elements(text: Text): List<Pair<String, Rect>> =
        text.textBlocks.flatMap { it.lines }.flatMap { it.elements }.mapNotNull { e -> e.boundingBox?.let { e.text to it } }

    private fun iou(a: Rect, b: Rect): Double {
        val inter = Rect()
        if (!inter.setIntersect(a, b)) return 0.0
        val i = inter.width().toDouble() * inter.height()
        return i / (a.width().toDouble() * a.height() + b.width().toDouble() * b.height() - i)
    }
}
