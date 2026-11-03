package io.github.fingerpost.camera

import io.github.fingerpost.guidance.Vec2

/** The consumer owns each AnalysisFrame bitmap; sources stop and drain before vision is released. */
interface FrameSource {
    fun start()
    fun stop()
    fun close(onDrained: () -> Unit = {})
    fun meterAt(point: Vec2, frameWidth: Int, frameHeight: Int) {}
}

class PhoneCameraSource(private val camera: CameraPipeline) : FrameSource {
    override fun start() = camera.start()
    override fun stop() = camera.stop()
    override fun close(onDrained: () -> Unit) = camera.close(onDrained)
    override fun meterAt(point: Vec2, frameWidth: Int, frameHeight: Int) = camera.meterAt(point, frameWidth, frameHeight)
}
