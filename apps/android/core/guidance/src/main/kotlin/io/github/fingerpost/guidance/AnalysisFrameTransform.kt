package io.github.fingerpost.guidance

/** Projects a raw camera crop into model input without a full-size rotated bitmap. */
class AnalysisFrameTransform(
    private val cropLeft: Int,
    private val cropTop: Int,
    private val cropWidth: Int,
    private val cropHeight: Int,
    private val rotationDegrees: Int,
    private val modelWidth: Int = 640,
    private val modelHeight: Int = 480,
) {
    init {
        require(cropLeft >= 0 && cropTop >= 0)
        require(cropWidth > 0 && cropHeight > 0 && modelWidth > 0 && modelHeight > 0)
        require(rotationDegrees in listOf(0, 90, 180, 270))
    }

    val uprightWidth: Int = if (rotationDegrees % 180 == 0) cropWidth else cropHeight
    val uprightHeight: Int = if (rotationDegrees % 180 == 0) cropHeight else cropWidth
    val letterbox: FrameTransform = FrameTransform.fitCenter(uprightWidth, uprightHeight, modelWidth, modelHeight)

    fun rawToModel(x: Float, y: Float): FramePoint {
        val localX = x - cropLeft
        val localY = y - cropTop
        val upright = when (rotationDegrees) {
            0 -> FramePoint(localX, localY)
            90 -> FramePoint(cropHeight - localY, localX)
            180 -> FramePoint(cropWidth - localX, cropHeight - localY)
            else -> FramePoint(localY, cropWidth - localX)
        }
        return letterbox.map(upright.x, upright.y)
    }

    fun normalizedToUpright(x: Float, y: Float): FramePoint = letterbox.unmap(x * modelWidth, y * modelHeight)
}
