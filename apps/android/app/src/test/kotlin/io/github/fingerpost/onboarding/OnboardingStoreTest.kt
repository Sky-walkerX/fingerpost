package io.github.fingerpost.onboarding

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import java.nio.file.Path
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir

class OnboardingStoreTest {
    @TempDir lateinit var directory: Path

    @Test fun `new installation has not completed its tutorial`() = runBlocking {
        val job = SupervisorJob()
        val data = PreferenceDataStoreFactory.create(scope = CoroutineScope(job + Dispatchers.IO),
            produceFile = { directory.resolve("tutorial.preferences_pb").toFile() })
        try { assertFalse(OnboardingStore(data).completed.first()) }
        finally { job.cancelAndJoin() }
    }

    @Test fun `completion survives reopening the actual datastore`() = runBlocking {
        val file = directory.resolve("tutorial.preferences_pb").toFile()
        val firstJob = SupervisorJob()
        val first = PreferenceDataStoreFactory.create(scope = CoroutineScope(firstJob + Dispatchers.IO), produceFile = { file })
        try { OnboardingStore(first).markCompleted() }
        finally { firstJob.cancelAndJoin() }
        val secondJob = SupervisorJob()
        val reopened = PreferenceDataStoreFactory.create(scope = CoroutineScope(secondJob + Dispatchers.IO), produceFile = { file })
        try { assertTrue(OnboardingStore(reopened).completed.first()) }
        finally { secondJob.cancelAndJoin() }
    }
}
