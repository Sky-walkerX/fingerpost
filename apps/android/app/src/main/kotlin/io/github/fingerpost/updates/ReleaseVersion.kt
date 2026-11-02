package io.github.fingerpost.updates

object ReleaseVersion {
    private val version = Regex("^v?(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z.-]+))?$")
    private fun parse(value: String): Pair<List<Int>, Boolean>? {
        val match = version.matchEntire(value) ?: return null
        val numbers = (1..3).map { match.groupValues[it].toIntOrNull() ?: return null }
        return numbers to match.groupValues[4].isNotEmpty()
    }
    fun isNewer(tag: String, installed: String): Boolean {
        val (next, prerelease) = parse(tag) ?: return false
        val (current, currentPrerelease) = parse(installed) ?: return false
        if (prerelease) return false
        for (i in next.indices) if (next[i] != current[i]) return next[i] > current[i]
        return currentPrerelease
    }
}
