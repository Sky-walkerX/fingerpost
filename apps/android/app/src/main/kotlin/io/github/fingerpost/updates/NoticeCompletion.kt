package io.github.fingerpost.updates

import io.github.fingerpost.guidance.Utterance

/** A notice is remembered only after the exact utterance finishes successfully. */
internal class NoticeCompletion {
    private var expected: Utterance? = null
    private var onDone: (() -> Unit)? = null
    fun track(utterance: Utterance, completed: () -> Unit) {
        expected = utterance
        onDone = completed
    }
    fun succeeded(utterance: Utterance) {
        if (expected !== utterance) return
        val completed = onDone
        clear()
        completed?.invoke()
    }
    fun clear() { expected = null; onDone = null }
}
