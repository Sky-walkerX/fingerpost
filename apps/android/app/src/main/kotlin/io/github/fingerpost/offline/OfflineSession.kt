package io.github.fingerpost.offline

import io.github.fingerpost.guidance.Evidence
import io.github.fingerpost.guidance.Key
import io.github.fingerpost.guidance.OcrToken
import io.github.fingerpost.guidance.OfflinePhrases
import io.github.fingerpost.guidance.OfflineResolver
import io.github.fingerpost.guidance.OfflineResult
import io.github.fingerpost.guidance.Strings
import io.github.fingerpost.guidance.Vec2
import java.util.Locale

sealed interface OfflineLocate {
    /** [polygon] is the OCR box in screen-normalized units, the same space as a server target. */
    data class Target(val polygon: List<Vec2>, val say: String) : OfflineLocate
    data class NotFound(val say: String) : OfflineLocate
}

/**
 * Days 4–7 plan, A6-1: the cloud-free stand-in for the gateway's locate and verify. Pure (no Android), so the
 * engine just swaps it in for keyframe uploads when the session is in basic mode.
 */
class OfflineSession {
    fun locate(goal: String, screenTokens: List<OcrToken>, locale: Locale): OfflineLocate = when (val r = OfflineResolver.resolve(goal, screenTokens)) {
        is OfflineResult.Match -> {
            val t = r.token
            OfflineLocate.Target(listOf(Vec2(t.u, t.v), Vec2(t.u + t.w, t.v), Vec2(t.u + t.w, t.v + t.h), Vec2(t.u, t.v + t.h)), OfflinePhrases.found(t, locale))
        }
        is OfflineResult.Ambiguous -> OfflineLocate.NotFound(OfflinePhrases.which(r.tokens, locale))
        OfflineResult.IconGoal -> OfflineLocate.NotFound(Strings.get(Key.ICON_NEEDS_CLOUD, locale))
        OfflineResult.None -> OfflineLocate.NotFound(OfflinePhrases.notFound(OfflineResolver.goalCore(goal).ifEmpty { goal.trim() },
            OfflineResolver.visibleLabels(screenTokens), locale))
    }

    /** No server verify offline: a seen screen change counts as done; dwell alone is weak (guidance-spec §9). */
    fun verifySay(evidence: Evidence?, locale: Locale): String =
        Strings.get(if (evidence == Evidence.DWELL) Key.OFFLINE_DWELL_DONE else Key.DONE, locale)
}
