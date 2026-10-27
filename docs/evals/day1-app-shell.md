# D1-T7b app-shell acceptance

Date: 2026-10-28. Device label: connected Android test device. No hardware identifiers are recorded.

| Requirement | Result | Evidence |
|---|---|---|
| Required Android checks and debug build | Pass | `./scripts/android.sh :core:guidance:test :app:test :app:assembleDebug --console=plain` succeeds. Guidance has 12 tests; app unit-test task has no source cases. |
| Install and launch | Pass | Debug APK installed; MainActivity cold launch returns `Status: ok`. |
| Permission-denial explanation is spoken | Pass | User confirmed hearing the exact camera-needed message after denying permission with TalkBack enabled. |
| Open settings targets this app | Pass | Device activity state contains `android.settings.APPLICATION_DETAILS_SETTINGS` with `package:io.github.fingerpost`. |
| Grant camera and return to the black session screen | Pending | Awaiting user acceptance and permission-state verification. |
| One TalkBack session element with the specified description | Pending | Awaiting user confirmation of the focused session element and swipe navigation. |

The shell's session action is reserved for the tone prototype in D1-T7d. Camera preview and fingertip tracking are D1-T7c; they are not acceptance requirements for this shell task. No camera frames or audio are captured for these checks.

Task completion remains pending until every row passes.
