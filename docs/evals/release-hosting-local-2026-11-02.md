# Release and Hosting local verification — 2 November 2026

Local fixes retain the external acceptance gates for B6-1 and C6-1.

## Release

Release preflight previously accepted eleven newly tested malformed gateway values, including Java string delimiters/control characters, invalid DNS labels, ambiguous numeric loopback hosts and empty/zero ports. Those regressions and two non-ASCII version-number regressions first failed, then passed after literal-safe WSS syntax, hostname, port and ASCII version validation. DNS names, IPv4 and IPv6 literals with valid ports remain supported.

The workflow now creates the keystore with owner-only permissions, reads its password through keytool's environment-password option and requires exactly 64 lowercase hex certificate digits before exporting the public fingerprint. Before publishing, `scripts/verify-release-apk.py` invokes the existing `apksigner verify --verbose --print-certs`, requires successful cryptographic verification, and compares the sole primary signer's SHA-256 digest to the configured keystore. Wrong, missing or additional signer digests fail closed. Captured tool diagnostics are not relayed.

All 50 Python tooling tests pass, including eleven release tests with subprocess-based synthetic signer success, cryptographic-tool failure with a matching digest, wrong/missing/extra signers, safe argument passing and diagnostic suppression. Release workflow YAML parses. These tests do not establish that an actual APK is signed: no SDK, keystore, Firebase secret, real signing, release tag or clean-phone installation was used. No apksigner is available on PATH, and no tools were downloaded.

## Website

Hosting config now targets only `apps/web/dist`, preserves Firestore rules, supplies cache/security headers and uses directory indexes plus a custom 404 without a landing-page fallback. Vite preview is explicitly multipage. All 53 web tests, recursive workspace typechecks, the production build and actual loopback HTTP smoke check pass: six distinct pages, ten linked/emitted resources, three missing routes returning 404, and a custom 404 artifact. CI now builds the website and runs the HTTP check. The local HTTP listener required sandbox escalation and was approved; it was closed after the check. Each request is bounded to five seconds and connections close even when an assertion fails.

The installed environment has no Firebase CLI. Firebase emulator header/redirect behavior and deployment remain unverified; [the deployment handoff](../site-deployment.md) lists the exact acceptance steps. Current privacy/data-safety crash statements match the default-off build flag; enabling uploads still requires disclosure and privacy acceptance. No public site or waitlist was opened.
