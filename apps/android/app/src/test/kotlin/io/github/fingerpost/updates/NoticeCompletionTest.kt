package io.github.fingerpost.updates

import io.github.fingerpost.guidance.Priority
import io.github.fingerpost.guidance.Utterance
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class NoticeCompletionTest {
    @Test fun onlyTheMatchingSuccessfulUtterancePersistsOnce() {
        val receipt = NoticeCompletion()
        val utterance = Utterance("Synthetic notice", Priority.STATE, 0)
        var completed = 0
        receipt.track(utterance) { completed++ }
        receipt.succeeded(utterance.copy())
        assertEquals(0, completed)
        receipt.succeeded(utterance)
        receipt.succeeded(utterance)
        assertEquals(1, completed)
    }
    @Test fun cancellationOrFailureLeavesTheNoticeUnannounced() {
        val receipt = NoticeCompletion()
        val utterance = Utterance("Synthetic notice", Priority.STATE, 0)
        var completed = false
        receipt.track(utterance) { completed = true }
        receipt.clear()
        receipt.succeeded(utterance)
        assertFalse(completed)
    }
}
