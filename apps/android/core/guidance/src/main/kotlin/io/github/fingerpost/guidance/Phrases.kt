package io.github.fingerpost.guidance

enum class CueVerbosity { NORMAL, CONCISE, DETAILED }

object Phrases {
    fun render(cue: GuideCue, locale: String = "en", verbosity: CueVerbosity = CueVerbosity.NORMAL): String? {
        val language = java.util.Locale.forLanguageTag(locale).language
        require(language in setOf("en", "hi", "es")) { "Unsupported guidance locale" }
        val loc = java.util.Locale.forLanguageTag(language)
        val direction = if (cue.dirs.isEmpty()) null else {
            val qualifier = when (cue.magnitude) {
                MagnitudeWord.A_LOT -> " " + Strings.get(Key.A_LOT, loc)
                MagnitudeWord.A_LITTLE -> " " + Strings.get(Key.A_LITTLE, loc)
                MagnitudeWord.NONE, null -> ""
            }
            val dirs = if (verbosity == CueVerbosity.CONCISE) cue.dirs.take(1) else cue.dirs
            val prefix = if (verbosity == CueVerbosity.DETAILED) Strings.get(Key.MOVE_FINGER, loc) + " " else ""
            (prefix + dirs.joinToString(" ${Strings.get(Key.AND, loc)} ") { Strings.direction(it, loc) } + qualifier + ".")
                .replaceFirstChar { it.uppercaseChar() }
        }
        return listOfNotNull(if (cue.slowDown) Strings.get(Key.SLOW_DOWN, loc) else null, direction)
            .joinToString(" ").ifEmpty { null }
    }
}
