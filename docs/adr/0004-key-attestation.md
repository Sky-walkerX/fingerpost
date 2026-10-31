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
| RSA 4096 root (expires 2042-03-15) | `CE:DB:1C:B6:DC:89:6A:E5:EC:79:73:48:BC:E9:28:67:53:C2:B3:8E:E7:1C:E0:FB:E3:4A:9A:12:48:80:0D:FC` |
| ECDSA P-384 "Key Attestation CA1" (expires 2035-07-15) | `6D:9D:B4:CE:6C:5C:0B:29:31:66:D0:89:86:E0:57:74:A8:77:6C:EB:52:5D:9E:43:29:52:0D:E1:2B:A4:BC:C0` |
| RSA 4096 root (expired 2026-05-24; chains through it fail the validity check) | `C1:98:4A:3E:F4:5C:1E:2A:91:85:51:DE:10:60:3C:86:F7:05:1B:22:49:C4:89:1C:AE:32:30:EA:BD:0C:97:D5` |
| RSA 4096 root (expires 2034-11-18) | `1E:F1:A0:4B:8B:A5:8A:B9:45:89:AC:49:8C:89:82:A7:83:F2:4E:A7:30:7E:01:59:A0:C3:A7:3B:37:7D:87:CC` |
| RSA 4096 root (expires 2036-11-13) | `AB:66:41:17:8A:36:E1:79:AA:0C:1C:DD:DF:9A:16:EB:45:FA:20:94:3E:2B:8C:D7:C7:C0:5C:26:CF:8B:48:7A` |

Fetched 2026-10-29. **Human check pending:** compare these with the page before the first auth-on deploy.

Rechecked 2026-10-31: the SHA-256 set of all five local certificates exactly matches the five decoded certificates on the official page (two current, three previously issued). The automated check does not replace the human comparison. The bundle is unchanged.

## Consequences
- It's free and needs no Play listing. It isn't bulletproof (rooted devices with leaked keys), so per-uid and per-IP limits and the spend kill switch stay in place.
- The attestation code needs ASN.1 parsing (`pkijs`/`asn1js`) and tests with recorded chains.
