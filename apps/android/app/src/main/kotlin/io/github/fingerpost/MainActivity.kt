package io.github.fingerpost

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
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
import io.github.fingerpost.settings.Settings as AppSettings
import io.github.fingerpost.settings.SettingsScreen
import io.github.fingerpost.settings.settingsStore
import io.github.fingerpost.ui.FingerpostTheme
import io.github.fingerpost.ui.SessionScreen
import io.github.fingerpost.ui.OnboardingGate
import io.github.fingerpost.vision.TrackingOptions
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Guidance stays visible while the user's hands are on another screen.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val trackingOptions = TrackingOptions.fromIntent(intent)
        val simRunId = if (BuildConfig.DEBUG) intent.getStringExtra("fingerpost.simRunId")?.takeIf { it.length in 1..64 } else null
        setContent {
            FingerpostTheme {
                OnboardingGate {
                    var cameraGranted by remember { mutableStateOf(hasCameraPermission()) }
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
                                cameraGranted = hasCameraPermission()
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
                    val settings by settingsStore.settings.collectAsStateWithLifecycle(initialValue = AppSettings())
                    var showSettings by rememberSaveable { mutableStateOf(false) }
                    val scope = rememberCoroutineScope()

                    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                        if (showSettings) {
                            BackHandler { showSettings = false }
                            SettingsScreen(
                                settings = settings,
                                onUpdate = { updated -> scope.launch { settingsStore.save(updated) } },
                                onBack = { showSettings = false }
                            )
                        } else if (cameraGranted) {
                            SessionScreen(
                                trackingOptions = trackingOptions,
                                simRunId = simRunId,
                                settings = settings,
                                onOpenSettings = { showSettings = true }
                            )
                        } else {
                            Column(
                                modifier = Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp),
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
