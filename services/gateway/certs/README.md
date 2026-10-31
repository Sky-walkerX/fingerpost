# Google hardware attestation roots

`google-roots.pem` contains five public certificates from the [official Android attestation page](https://developer.android.com/privacy-and-security/security-key-attestation#root_certificate): two current and three previously issued certificates. The expired certificate is retained as published; the verifier rejects expired chains.

The five SHA-256 fingerprints are recorded in [ADR-0004](../../../docs/adr/0004-key-attestation.md). On 2026-10-31 an automated comparison of decoded certificates confirmed an exact match with all five on the official page. This is not the plan's required human review. A human must independently compare the fingerprints before the first auth-on deployment.

Do not add device certificate chains or private keys here. The verifier tests generate synthetic chains.
