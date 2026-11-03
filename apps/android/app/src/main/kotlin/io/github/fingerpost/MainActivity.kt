package io.github.fingerpost

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.WindowManager
import android.view.KeyEvent
import io.github.fingerpost.settings.HardwareCue
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.fingerpost.settings.SettingsScreen
import io.github.fingerpost.settings.settingsStore
import io.github.fingerpost.memory.layoutStore
import io.github.fingerpost.ui.FingerpostTheme
import io.github.fingerpost.ui.SessionScreen
import io.github.fingerpost.ui.OnboardingGate
import io.github.fingerpost.vision.TrackingOptions
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private var sessionKeys: ((HardwareCue) -> Boolean)? = null
    private val consumedKeys = mutableSetOf<Int>()

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        val cue = when (keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP -> HardwareCue.REPEAT
            KeyEvent.KEYCODE_VOLUME_DOWN -> HardwareCue.UNDER_FINGER
            else -> return super.onKeyDown(keyCode, event)
        }
        if (keyCode in consumedKeys) return true
        if (event.repeatCount == 0 && lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED) && sessionKeys?.invoke(cue) == true) {
            consumedKeys.add(keyCode)
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean =
        if (consumedKeys.remove(keyCode)) true else super.onKeyUp(keyCode, event)

    override fun onPause() { consumedKeys.clear(); super.onPause() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Guidance stays visible while the user's hands are on another screen.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val replayFile = io.github.fingerpost.camera.MockGlassesSource.selected(this,
            intent.getBooleanExtra("fingerpost.mockGlasses", false))
        val trackingOptions = TrackingOptions.fromIntent(intent)
        val simRunId = if (BuildConfig.DEBUG) intent.getStringExtra("fingerpost.simRunId")?.takeIf { it.length in 1..64 } else null
        setContent {
            FingerpostTheme {
                OnboardingGate {
                    var cameraGranted by remember { mutableStateOf(replayFile != null || hasCameraPermission()) }
                    var requested by rememberSaveable { mutableStateOf(false) }
                    var denied by rememberSaveable { mutableStateOf(false) }
                    val view = LocalView.current
                    val cameraNeeded = stringResource(R.string.camera_needed)
                    val lifecycleOwner = LocalLifecycleOwner.current
                    val permission = rememberLauncherForActivityResult(
                        ActivityResultContracts.RequestPermission(),
                    ) { granted ->
                        cameraGranted = granted
                        denied = !granted
                    }

                    DisposableEffect(lifecycleOwner) {
                        val observer = LifecycleEventObserver { _, event ->
                            if (event == Lifecycle.Event.ON_RESUME) {
                                cameraGranted = replayFile != null || hasCameraPermission()
                                if (cameraGranted) denied = false
                            }
                        }
                        lifecycleOwner.lifecycle.addObserver(observer)
                        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
                    }
                    LaunchedEffect(Unit) {
                        if (!cameraGranted && !requested) {
                            requested = true
                            permission.launch(Manifest.permission.CAMERA)
                        }
                    }
                    LaunchedEffect(denied) {
                        if (denied) view.announceForAccessibility(cameraNeeded)
                    }

                    val settingsStore = remember(this@MainActivity) { settingsStore(this@MainActivity) }
                    val storedSettings by settingsStore.settings.collectAsStateWithLifecycle(initialValue = null)
                    val settings = storedSettings ?: return@OnboardingGate
                    var showSettings by rememberSaveable { mutableStateOf(false) }
                    val scope = rememberCoroutineScope()
                    val updateCheck = remember { io.github.fingerpost.updates.UpdateCheck(this@MainActivity) }
                    var checkedUpdates by rememberSaveable { mutableStateOf(false) }
                    var availableUpdate by rememberSaveable { mutableStateOf<String?>(null) }
                    LaunchedEffect(Unit) {
                        if (!checkedUpdates) {
                            availableUpdate = updateCheck.latestUnannounced()
                            checkedUpdates = true
                        }
                    }

                    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                        if (showSettings) {
                            BackHandler { showSettings = false }
                            SettingsScreen(
                                settings = settings,
                                onUpdate = { updated -> scope.launch { settingsStore.save(updated) } },
                                onBack = { showSettings = false },
                                onClearSavedScreens = { scope.launch { layoutStore(this@MainActivity).clearNow() } }
                            )
                        } else if (cameraGranted) {
                            SessionScreen(
                                trackingOptions = trackingOptions,
                                simRunId = simRunId,
                                replayFile = replayFile,
                                settings = settings,
                                availableUpdate = availableUpdate,
                                onUpdateAnnounced = { tag -> updateCheck.announced(tag); availableUpdate = null },
                                onOpenSettings = { showSettings = true },
                                onKeyHandlerChanged = { sessionKeys = it }
                            )
                        } else {
                            Column(
                                modifier = Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(24.dp),
                                verticalArrangement = Arrangement.spacedBy(24.dp, androidx.compose.ui.Alignment.CenterVertically),
                            ) {
                                Text(cameraNeeded, style = MaterialTheme.typography.bodyLarge)
                                Button(onClick = {
                                    startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                        Uri.fromParts("package", packageName, null)))
                                }) { Text(stringResource(R.string.open_settings)) }
                            }
                        }
                    }
                }
            }
        }
    }

    private fun hasCameraPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
}
