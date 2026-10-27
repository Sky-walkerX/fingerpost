# ADR 0004: Android Key Attestation instead of Firebase App Check
- Status: accepted (2026-10-27)

## Context
We need to stop scripts from draining the shared API budget. Firebase App Check's Play Integrity provider requires the app to be recognised by Google Play, and our APK is sideloaded from GitHub Releases.

## Decision
1. The client requests a nonce (`POST /v1/auth/challenge`) and generates a hardware-backed EC key in Android Keystore, with `setAttestationChallenge(nonce)`.
2. It sends the certificate chain to `POST /v1/auth/attest`.
3. The gateway verifies:
   - the chain up to Google's hardware attestation roots;
   - the revocation status list;
   - the challenge;
   - `attestationApplicationId`: package `io.github.fingerpost` and our signing-cert SHA-256;
   - security level, TEE or StrongBox.
4. The gateway issues a 15-minute JWT bound to the Firebase anonymous uid and the key.
5. Software-only attestation still gets a token, with a lower quota. This keeps emulators and older devices working.

## Roots
`services/gateway/certs/google-roots.pem` holds the root certificates published at https://developer.android.com/privacy-and-security/security-key-attestation#root_certificate.
Their fingerprints are recorded here on Day 3 (task D3-T5), and a human checks them against that page:

| Root | SHA-256 fingerprint |
|---|---|
| _(fill in)_ | _(fill in)_ |

## Consequences
- It's free and needs no Play listing. It isn't bulletproof (rooted devices with leaked keys), so per-uid and per-IP limits and the spend kill switch stay in place.
- The attestation code needs ASN.1 parsing (`pkijs`/`asn1js`) and tests with recorded chains.
