package io.github.fingerpost.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import io.github.fingerpost.R

@Composable
fun SessionScreen(onToggle: () -> Unit) {
    val description = stringResource(R.string.session_description)
    Box(Modifier.fillMaxSize().background(Color.Black)
        .semantics(mergeDescendants = true) { contentDescription = description }
        .clickable(onClick = onToggle))
}
