package io.github.fingerpost.guidance

/** Just enough JSON for the synthetic fixtures; core:guidance stays dependency-free. */
internal object Json {
    fun parse(s: String): Any? = Parser(s).run { value().also { ws(); require(i == s.length) { "trailing JSON" } } }

    private class Parser(val s: String) {
        var i = 0
        fun ws() { while (i < s.length && s[i].isWhitespace()) i++ }
        fun value(): Any? {
            ws()
            return when (val c = s[i]) {
                '{' -> obj(); '[' -> arr(); '"' -> str()
                't' -> lit("true", true); 'f' -> lit("false", false); 'n' -> lit("null", null)
                else -> if (c == '-' || c.isDigit()) num() else error("bad JSON at $i")
            }
        }
        fun lit(word: String, v: Any?): Any? { require(s.startsWith(word, i)); i += word.length; return v }
        fun num(): Any { val start = i; while (i < s.length && s[i] in "+-0123456789.eE") i++; val t = s.substring(start, i)
            return t.toLongOrNull() ?: t.toDouble() }
        fun str(): String {
            val b = StringBuilder(); i++
            while (s[i] != '"') {
                if (s[i] == '\\') { i++
                    when (val e = s[i]) {
                        'n' -> b.append('\n'); 't' -> b.append('\t'); 'r' -> b.append('\r'); 'b' -> b.append('\b'); 'f' -> b.append('\u000c')
                        'u' -> { b.append(s.substring(i + 1, i + 5).toInt(16).toChar()); i += 4 }
                        else -> b.append(e)
                    }
                } else b.append(s[i])
                i++
            }
            i++; return b.toString()
        }
        fun arr(): List<Any?> { i++; val out = mutableListOf<Any?>(); ws()
            if (s[i] == ']') { i++; return out }
            while (true) { out += value(); ws(); if (s[i++] == ']') return out } }
        fun obj(): Map<String, Any?> { i++; val out = linkedMapOf<String, Any?>(); ws()
            if (s[i] == '}') { i++; return out }
            while (true) { ws(); val k = str(); ws(); i++; out[k] = value(); ws(); if (s[i++] == '}') return out } }
    }
}
