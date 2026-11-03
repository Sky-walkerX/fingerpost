package io.github.fingerpost

import android.app.PendingIntent
import android.annotation.SuppressLint
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/** Launches the normal foreground flow, including onboarding and permission gates. */
class GuidanceTileService : TileService() {
    override fun onStartListening() {
        super.onStartListening()
        qsTile?.apply { state = Tile.STATE_INACTIVE; updateTile() }
    }

    override fun onClick() {
        super.onClick()
        // Do not start the camera or microphone from a locked tile/service context.
        if (isLocked) unlockAndRun { openGuidance() } else openGuidance()
    }

    private fun openGuidance() {
        val intent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        if (Build.VERSION.SDK_INT >= 34) {
            startActivityAndCollapse(PendingIntent.getActivity(this, 0, intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
        } else {
            openBefore34(intent)
        }
    }

    // The replacement does not exist on API 29–33; this call is unreachable on API 34+.
    @SuppressLint("StartActivityAndCollapseDeprecated")
    @Suppress("DEPRECATION")
    private fun openBefore34(intent: Intent) = startActivityAndCollapse(intent)
}
