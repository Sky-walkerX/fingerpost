# ADR 0001: Android-first native client (Kotlin)
- Status: accepted (2026-10-27)

## Context
The budget is $0. TestFlight and the App Store need the $99/yr Apple Developer Program, and Google Play production needs a 12-tester, 14-day closed test for new personal accounts. Most blind smartphone users outside the US and EU use Android with TalkBack, and so will our local testers. The team knows Kotlin, Swift and TypeScript.

## Decision
- Ship a native Android app (Kotlin, Jetpack Compose) as the v1 client.
- Distribute it as a signed APK on GitHub Releases, linked from fingerpost.web.app.
- iOS follows once it's funded. It reimplements `docs/guidance-spec.md` against the same gateway and protocol.

## Consequences
- Anyone can install it for free, with no review gate. Sideloading adds friction, so we ship an accessible install guide and an in-app update check.
- No Play Integrity (see ADR 0004).
- The demo video is recorded on Android.
