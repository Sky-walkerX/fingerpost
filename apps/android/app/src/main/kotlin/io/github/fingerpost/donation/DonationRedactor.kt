package io.github.fingerpost.donation

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import io.github.fingerpost.guidance.OcrToken
import io.github.fingerpost.guidance.donationNumberMasks
import io.github.fingerpost.vision.FaceCover
import java.io.ByteArrayOutputStream
import kotlin.math.floor
import kotlin.math.ceil

/** Never retains an unchecked frame. Face detection failure already blacks the whole bitmap. */
class DonationRedactor(private val faces: FaceCover) {
    fun encode(bitmap: Bitmap, tokens: List<OcrToken>): ByteArray? {
        val covered = faces.cover(bitmap)
        return try {
            val canvas = Canvas(covered)
            val black = Paint().apply { color = Color.BLACK }
            for (b in donationNumberMasks(tokens)) canvas.drawRect(floor(b.x*covered.width).toFloat(),
                floor(b.y*covered.height).toFloat(), ceil((b.x+b.width)*covered.width).toFloat(),
                ceil((b.y+b.height)*covered.height).toFloat(), black)
            for (quality in intArrayOf(80,65,50)) {
                val out = ByteArrayOutputStream()
                if (covered.compress(Bitmap.CompressFormat.JPEG,quality,out) && out.size() in 1..409_600) return out.toByteArray()
            }
            null
        } finally { covered.recycle() }
    }
}
