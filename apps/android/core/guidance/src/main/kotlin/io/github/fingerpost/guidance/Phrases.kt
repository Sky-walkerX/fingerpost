package io.github.fingerpost.guidance

/** Day 2 ships English; Day 4 adds "hi" and "es" tables with the same keys. */
object Phrases {
    private val dirEn = mapOf(Dir.UP to "up", Dir.DOWN to "down", Dir.LEFT to "left", Dir.RIGHT to "right", Dir.FORWARD to "forward", Dir.BACK to "back")

    fun render(cue: GuideCue, locale: String = "en"): String? {
        require(locale == "en") { "Unsupported guidance locale" }
        val direction = if (cue.dirs.isEmpty()) null else {
            val qualifier = when (cue.magnitude) {
                MagnitudeWord.A_LOT -> " a lot"
                MagnitudeWord.A_LITTLE -> " a little"
                MagnitudeWord.NONE, null -> ""
            }
            (cue.dirs.joinToString(" and ") { dirEn.getValue(it) } + qualifier + ".")
                .replaceFirstChar { it.uppercaseChar() }
        }
        return listOfNotNull(if (cue.slowDown) "Slow down." else null, direction)
            .joinToString(" ").ifEmpty { null }
    }
}
