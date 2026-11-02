# Android crash reporting

Crashlytics source configuration is present for A5-3. It uses the existing Firebase BoM 35.1.0 and pins the Crashlytics Gradle plugin to 3.0.8. The Google Services and Crashlytics plugins apply only when the ignored `apps/android/app/google-services.json` exists. No Analytics dependency, custom keys, user identifiers, custom logs or recorded nonfatal exceptions were added.

Automatic report collection defaults to **false** through the `firebase_crashlytics_collection_enabled` manifest metadata. Debug builds always use false. Release builds enable collection only with the exact Gradle property `-Pfingerpost.crashReporting=true`; omitting it or using any other value keeps collection disabled. The release workflow does not opt in by default. No runtime setter overrides this choice.

Before distributing an enabled build, update the public privacy/data-safety disclosures and complete the consent and data review. Automatic fatal reports can include stack traces, exception messages and device/app metadata; this integration does not sanitize SDK-generated reports. Never put OCR, transcripts, images, PINs or session content in exceptions, keys or logs. Disabled collection can retain reports locally; it does not establish that no crash data exists on the phone.

This is source-only integration. Gradle dependency resolution, plugin/AGP compatibility, merged manifest values, APK compilation, device collection behavior and Firebase console delivery are **unverified**. No SDK downloads, forced crash, Firebase data calls or report delivery tests were performed. Once Android verification is authorized, check both build variants with and without the opt-in, confirm merged manifest values, and perform a consented synthetic crash test without user content. Build configuration alone does not complete A5-3 or the crash-free soak acceptance.

Implementation references: [Firebase Android setup](https://firebase.google.com/docs/crashlytics/android/get-started) and [collection controls](https://firebase.google.com/docs/crashlytics/customize-crash-reports?platform=android#enable-reporting).
