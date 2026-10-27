package io.github.fingerpost.guidance

/** Day 2 ships English; Day 4 adds "hi" and "es" tables with the same keys. */
object Phrases {
    private val dirEn = mapOf(Dir.UP to "up", Dir.DOWN to "down", Dir.LEFT to "left", Dir.RIGHT to "right", Dir.FORWARD to "forward", Dir.BACK to "back")

    fun render(cue: GuideCue, locale: String = "en"): String? { TODO("D2-T3: implement; the tests describe the behaviour") }
}
