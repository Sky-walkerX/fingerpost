package io.github.fingerpost.guidance

enum class SpeechInput { CLOUD, LOCAL, NONE }
enum class LocalSpeechTurn { GOAL, REPLY, TOUCH_EXPLORE }

/** Once protected content is seen, speech stays local until a new session is created. */
class SpeechPrivacy(privateSession: Boolean) {
    var localOnly = privateSession; private set
    fun requireLocal() { localOnly = true }
    fun shouldFallbackAfterCloudError(state: GState, pinMode: Boolean): Boolean =
        !localOnly && !pinMode && state in setOf(GState.LISTENING, GState.ASK, GState.CONFIRM, GState.EXPLORING)
    fun input(offline: Boolean, pinMode: Boolean): SpeechInput = when {
        pinMode -> SpeechInput.NONE
        offline || localOnly -> SpeechInput.LOCAL
        else -> SpeechInput.CLOUD
    }
    fun turn(state: GState, offline: Boolean, pinMode: Boolean, text: String): LocalSpeechTurn? {
        if (input(offline, pinMode) != SpeechInput.LOCAL || text.isBlank() || text.length > 500) return null
        if (offline) return if (state == GState.LISTENING) LocalSpeechTurn.GOAL else null
        return when (state) {
            GState.LISTENING -> LocalSpeechTurn.GOAL
            GState.ASK, GState.CONFIRM -> LocalSpeechTurn.REPLY
            GState.EXPLORING -> if (isTouchExploreCommand(text)) LocalSpeechTurn.TOUCH_EXPLORE else LocalSpeechTurn.GOAL
            else -> null
        }
    }
}
