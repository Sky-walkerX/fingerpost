package io.github.fingerpost.guidance

import java.io.File
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

/**
 * Contract replay (Days 4–7 plan, "Contracts"): the server half of each shared flow script is fed to the
 * state machine as events, and the client messages it emits must match the script's client half in order.
 * Device-side stimuli the script implies (a stable frame, the finger on target, a sim press, a spoken yes,
 * the PIN gate) are fed only when the script expects their message next.
 */
class FlowReplayTest {
    private val dir = File(System.getProperty("fixtures.dir") ?: "../../../../packages/protocol/fixtures", "flows")

    @Test fun mediumColaFlow() = replay("medium-cola")
    @Test fun guideStartFlow() = replay("guide-start")
    @Test fun goBackFlow() = replay("go-back")
    @Test fun exploreSummaryFlow() = replay("explore-summary")

    @Suppress("UNCHECKED_CAST")
    private fun replay(name: String) {
        val flow = Json.parse(File(dir, "$name.json").readText()) as Map<String, Any?>
        val steps = flow["steps"] as List<Map<String, Any?>>
        val m = GuidanceStateMachine()
        var now = 0L
        val produced = ArrayDeque<String>()
        fun feed(e: (Long) -> GEvent) { now += 100; m.handle(e(now)).mapNotNullTo(produced, ::signature) }
        val roles = mutableMapOf<String, String>()

        feed { GEvent.Start(it) }
        for (step in steps) {
            val msg = step["msg"] as Map<String, Any?>
            val type = msg["type"] as String
            if (step["from"] == "server") when (type) {
                "goal.ack" -> feed { GEvent.IntentArrived(it, msg["intent"] as String) }
                "layout" -> (msg["elements"] as List<Map<String, Any?>>).forEach { roles[it["id"] as String] = it["role"] as String }
                "target" -> feed { GEvent.TargetArrived(it, msg["say"] as String, roles[msg["elementId"]] ?: "button") }
                "verify" -> feed { GEvent.VerifyArrived(it, VerifyResult.valueOf((msg["result"] as String).uppercase()), msg["say"] as String) }
                "confirm" -> feed { GEvent.ConfirmArrived(it, msg["id"] as String, msg["summary"] as String,
                    (msg["amount"] as Map<String, Any?>?)?.let { a -> "${a["currency"]} ${a["value"]}" }) }
                "ask" -> feed { GEvent.AskArrived(it, msg["id"] as String, msg["question"] as String, msg["options"] as List<String>) }
                "finish" -> feed { GEvent.FinishArrived(it, msg["result"] as String, msg["say"] as String) }
                "say" -> feed { GEvent.ExploreSaid(it) }
                else -> Unit // ready, sim.touch: the press evidence is fed with the client's tapDetected below
            } else {
                if (type == "hello" || type == "abort") continue  // engine-level: the session's user controls
                if (type == "goal") { feed { GEvent.GoalHeard(it, msg["text"] as String) }; continue }
                val want = clientSignature(msg)
                if (produced.isEmpty()) when (want) {
                    "keyframe:locate", "keyframe:explore" -> feed { GEvent.Frame(it, true, false, null) }
                    "event:targetReached" -> repeat(6) { feed { t -> GEvent.Frame(t, false, true, Zone.ON) } }
                    "event:tapDetected:sim" -> feed { GEvent.PressDetected(it, Evidence.SIM) }
                    "confirm.reply:true" -> feed { GEvent.UserSaid(it, "yes") }
                    "confirm.reply:false" -> feed { GEvent.UserSaid(it, "no") }
                    "event:pinModeEntered" -> feed { GEvent.PinGate(it, blocked = true, digitTokens = 10) }
                    // The kiosk took a press that wasn't our target (go-back): the relayed sim touch is the stimulus.
                    "event:screenChanged" -> feed { GEvent.PressDetected(it, Evidence.SIM) }
                }
                assertEquals(want, produced.removeFirstOrNull(), "$name: client message at ${steps.indexOf(step)}")
            }
        }
        assertEquals(emptyList<String>(), produced.toList(), "$name: unexpected client messages")
    }

    private fun signature(e: Effect): String? = when (e) {
        is Effect.SendKeyframe -> "keyframe:${e.purpose.name.lowercase()}"
        Effect.SendTargetReached -> "event:targetReached"
        is Effect.SendTapDetected -> "event:tapDetected:${e.evidence.name.lowercase()}"
        is Effect.SendConfirmReply -> "confirm.reply:${e.accepted}"
        is Effect.SendAnswer -> "answer"
        Effect.EnterPinMode -> "event:pinModeEntered"
        Effect.SendScreenChanged -> "event:screenChanged"
        else -> null
    }

    @Suppress("UNCHECKED_CAST")
    private fun clientSignature(msg: Map<String, Any?>): String = when (msg["type"]) {
        "keyframe" -> "keyframe:${msg["purpose"]}"
        "event" -> listOfNotNull("event", msg["kind"] as String, ((msg["detail"] as Map<String, Any?>?)?.get("evidence")) as String?).joinToString(":")
        "confirm.reply" -> "confirm.reply:${msg["accepted"]}"
        else -> msg["type"] as String
    }
}

/** Just enough JSON for the synthetic fixtures; core:guidance stays dependency-free. */
private object Json {
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
